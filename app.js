// Global variables
let localPeerId = Math.random().toString(36).substr(2, 9);
let peerConnection = null;
let dataChannel = null;
let discoveredPeers = [];
const statusDiv = document.getElementById('status');
const peersDiv = document.getElementById('peers');

// WebSocket signaling server
const signalingServer = new WebSocket('ws://localhost:3000');

signalingServer.onopen = () => {
  console.log('Connected to signaling server');
  updateStatus('Connected to signaling server');
  // Register with the server
  signalingServer.send(JSON.stringify({
    type: 'register',
    peerId: localPeerId
  }));
};

signalingServer.onmessage = (event) => {
  console.log('Received message:', event.data);
  try {
    const data = JSON.parse(event.data);
    console.log('Parsed message data:', data);
    handleSignalingMessage(data);
  } catch (err) {
    console.error('Error parsing message:', err);
    console.error('Raw message data:', event.data);
  }
};

signalingServer.onerror = (error) => {
  console.error('WebSocket error:', error);
  updateStatus('WebSocket error');
};

function handleSignalingMessage(data) {
  switch (data.type) {
    case 'discover':
      // Another peer is looking for peers, respond with our ID
      console.log('Responding to discovery from:', data.peerId);
      signalingServer.send(JSON.stringify({
        type: 'peer',
        peerId: localPeerId,
        from: localPeerId,
        to: data.peerId
      }));
      break;
    case 'peer':
      // We discovered a peer
      if (data.to === localPeerId && !discoveredPeers.includes(data.peerId)) {
        console.log('Discovered peer:', data.peerId);
        discoveredPeers.push(data.peerId);
        updatePeersList();
        updateStatus(`Peer discovered: ${data.peerId}`);
      }
      break;
    case 'offer':
      // Received connection offer
      console.log('Received offer from:', data.from);
      handleOffer(data);
      break;
    case 'answer':
      // Received connection answer
      console.log('Received answer from:', data.from);
      handleAnswer(data);
      break;
    case 'ice-candidate':
      // Received ICE candidate
      if (data.to === localPeerId && peerConnection) {
        console.log('Adding ICE candidate');
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch(err => console.error('Error adding ICE candidate:', err));
      }
      break;
  }
}

// Event listeners
document.getElementById('discoverPeers').addEventListener('click', () => {
  console.log('Starting peer discovery...');
  discoveredPeers = []; // Clear previous peers
  updatePeersList();
  signalingServer.send(JSON.stringify({
    type: 'discover',
    peerId: localPeerId
  }));
  updateStatus('Discovering peers...');
});

document.getElementById('connectPeer').addEventListener('click', () => {
  if (discoveredPeers.length > 0) {
    console.log('Connecting to peer:', discoveredPeers[0]);
    connectToPeer(discoveredPeers[0]);
    updateStatus('Connecting to peer...');
  } else {
    updateStatus('No peers discovered');
  }
});

document.getElementById('sendFile').addEventListener('click', () => {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (file && dataChannel && dataChannel.readyState === 'open') {
    console.log('Sending file:', file.name);
    updateStatus('Sending file...');

    // Send file metadata first
    const fileInfo = {
      type: 'file-info',
      name: file.name,
      size: file.size,
      mimeType: file.type
    };

    dataChannel.send(JSON.stringify(fileInfo));

    // Send file in chunks for better handling of large files
    const chunkSize = 16384; // 16KB chunks
    let offset = 0;

    const sendChunk = () => {
      if (offset >= file.size) {
        updateStatus('File sent');
        return;
      }

      const slice = file.slice(offset, offset + chunkSize);
      const reader = new FileReader();

      reader.onload = () => {
        dataChannel.send(reader.result);
        offset += chunkSize;
        updateStatus(`Sending file... ${Math.min(offset, file.size)} / ${file.size} bytes`);
        setTimeout(sendChunk, 0); // Allow other events to process
      };

      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        updateStatus('Error reading file: ' + reader.error.message);
      };

      reader.readAsArrayBuffer(slice);
    };

    sendChunk();
  } else {
    updateStatus('No active connection or file selected');
  }
});

// Helper functions
function updatePeersList() {
  peersDiv.innerHTML = discoveredPeers.map(peer => `<div>Peer: ${peer}</div>`).join('');
}

function updateStatus(message) {
  statusDiv.textContent = message;
}

function handleOffer(offer) {
  // Close any existing connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    dataChannel = null;
  }

  console.log('Creating peer connection for offer');
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    updateStatus(`Connection state: ${peerConnection.connectionState}`);

    // Handle connection failure
    if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
      updateStatus('Connection failed or disconnected');
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', peerConnection.iceConnectionState);

    // Handle ICE connection failure
    if (peerConnection.iceConnectionState === 'failed') {
      updateStatus('ICE connection failed');
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('ICE candidate:', event.candidate);
      signalingServer.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        to: offer.from,
        from: localPeerId
      }));
    }
  };

  // Handle data channel
  peerConnection.ondatachannel = (event) => {
    console.log('Data channel received');
    dataChannel = event.channel;
    dataChannel.onopen = () => {
      console.log('Data channel open');
      updateStatus('Data channel open - ready to send files');
    };

    // File receiving variables
    let receivedFileInfo = null;
    let receivedBuffers = [];
    let receivedSize = 0;

    dataChannel.onmessage = (event) => {
      try {
        // Check if it's file info (JSON)
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'file-info') {
              receivedFileInfo = data;
              receivedBuffers = [];
              receivedSize = 0;
              console.log('Receiving file:', receivedFileInfo.name);
              updateStatus(`Receiving file: ${receivedFileInfo.name}`);
              return;
            }
          } catch (e) {
            // Not JSON, treat as binary data
          }
        }

        // Handle binary data
        if (receivedFileInfo) {
          receivedBuffers.push(event.data);
          receivedSize += event.data.byteLength;

          updateStatus(`Receiving file: ${receivedFileInfo.name} (${receivedSize} / ${receivedFileInfo.size} bytes)`);

          // Check if we've received the complete file
          if (receivedSize >= receivedFileInfo.size) {
            console.log('File received completely');
            const blob = new Blob(receivedBuffers, { type: receivedFileInfo.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = receivedFileInfo.name;
            a.click();
            updateStatus('File received');

            // Reset for next file
            receivedFileInfo = null;
            receivedBuffers = [];
            receivedSize = 0;
          }
        } else {
          console.log('Received data without file info');
          updateStatus('Received data');
        }
      } catch (err) {
        console.error('Error handling received data:', err);
        updateStatus('Error receiving data: ' + err.message);
      }
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      updateStatus('Data channel error: ' + error.message);
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
      updateStatus('Data channel closed');
    };
  };

  // Ensure we have a proper session description
  const sessionDescription = new RTCSessionDescription({
    type: offer.offer.type || 'offer',
    sdp: offer.offer.sdp
  });

  peerConnection.setRemoteDescription(sessionDescription)
    .then(() => {
      console.log('Remote description set successfully');
      return peerConnection.createAnswer();
    })
    .then(answer => {
      console.log('Created answer:', answer);
      return peerConnection.setLocalDescription(answer);
    })
    .then(() => {
      console.log('Local description set successfully');
      const answerObj = peerConnection.localDescription;
      console.log('Sending answer:', answerObj);
      signalingServer.send(JSON.stringify({
        type: 'answer',
        answer: {
          type: answerObj.type,
          sdp: answerObj.sdp
        },
        to: offer.from,
        from: localPeerId
      }));
    })
    .catch(err => {
      console.error('Error handling offer:', err);
      updateStatus('Error creating answer: ' + err.message);
    });
}

function handleAnswer(answer) {
  if (peerConnection) {
    console.log('Setting remote description from answer:', answer);

    // Ensure we have a proper session description
    const sessionDescription = new RTCSessionDescription({
      type: answer.answer.type || 'answer',
      sdp: answer.answer.sdp
    });

    peerConnection.setRemoteDescription(sessionDescription)
      .then(() => {
        console.log('Remote description set successfully');
        updateStatus('Connected to peer');
      })
      .catch(err => {
        console.error('Error setting remote description:', err);
        updateStatus('Error connecting: ' + err.message);
      });
  }
}

function connectToPeer(peerId) {
  // Close any existing connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    dataChannel = null;
  }

  console.log('Creating peer connection for connection');
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    updateStatus(`Connection state: ${peerConnection.connectionState}`);

    // Handle connection failure
    if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
      updateStatus('Connection failed or disconnected');
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', peerConnection.iceConnectionState);

    // Handle ICE connection failure
    if (peerConnection.iceConnectionState === 'failed') {
      updateStatus('ICE connection failed');
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('ICE candidate:', event.candidate);
      signalingServer.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate,
        to: peerId,
        from: localPeerId
      }));
    }
  };

  // Create data channel
  dataChannel = peerConnection.createDataChannel('fileTransfer');
  dataChannel.onopen = () => {
    console.log('Data channel open');
    updateStatus('Data channel open - ready to send files');
  };

  dataChannel.onerror = (error) => {
    console.error('Data channel error:', error);
    updateStatus('Data channel error: ' + error.message);
  };

  dataChannel.onclose = () => {
    console.log('Data channel closed');
    updateStatus('Data channel closed');
  };

  peerConnection.createOffer()
    .then(offer => {
      console.log('Created offer:', offer);
      return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
      console.log('Local description set successfully');
      const offerObj = peerConnection.localDescription;
      console.log('Sending offer:', offerObj);
      // Validate the offer object before sending
      if (offerObj && offerObj.type && offerObj.sdp) {
        signalingServer.send(JSON.stringify({
          type: 'offer',
          offer: {
            type: offerObj.type,
            sdp: offerObj.sdp
          },
          from: localPeerId,
          to: peerId
        }));
      } else {
        console.error('Invalid offer object:', offerObj);
        updateStatus('Error: Invalid offer object');
      }
    })
    .catch(err => {
      console.error('Error creating offer:', err);
      updateStatus('Error creating offer: ' + err.message);
    });
}
