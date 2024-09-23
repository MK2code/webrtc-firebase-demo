import './style.css';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
const localIP = '172.31.50.32';
let socket;
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// 1. Setup media sources
// Client-side WebRTC using WebSocket

function connectToWebSocket() {
  socket = new WebSocket(`ws://${localIP}:8080`);

  socket.onopen = () => {
    console.log('Connected to WebSocket server');
    // Now that connection is open, you can enable the call and answer buttons
    callButton.disabled = false;
    answerButton.disabled = false;
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);

    if (data.type === 'offer') {
      const offerDescription = new RTCSessionDescription({
        type: 'offer',
        sdp: data.offer
      });
      pc.setRemoteDescription(offerDescription);
    } else if (data.type === 'answer') {
      const answerDescription = new RTCSessionDescription({
        type: 'answer',
        sdp: data.answer
      });
      pc.setRemoteDescription(answerDescription);
    } else if (data.type === 'candidate') {
      const candidate = new RTCIceCandidate(data.candidate);
      pc.addIceCandidate(candidate);
    }
  };
}


// When receiving messages from the WebSocket server
// socket.onmessage = (message) => {
//   const data = JSON.parse(message.data);

//   if (data.type === 'offer') {
//     const offerDescription = new RTCSessionDescription({
//       type: 'offer',
//       sdp: data.offer
//     });
//     pc.setRemoteDescription(offerDescription);
//   } else if (data.type === 'answer') {
//     const answerDescription = new RTCSessionDescription({
//       type: 'answer',
//       sdp: data.answer
//     });
//     pc.setRemoteDescription(answerDescription);
//   } else if (data.type === 'candidate') {
//     const candidate = new RTCIceCandidate(data.candidate);
//     pc.addIceCandidate(candidate);
//   }
// };

// Webcam setup
webcamButton.onclick = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
    webcamVideo.srcObject = localStream;
  } catch (error) {
    console.warn('No camera available, continuing without local video stream.');
    // If no camera, skip setting up the local stream
  }

  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  remoteVideo.srcObject = remoteStream;
  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// Create offer
callButton.onclick = async () => {
  if (socket.readyState !== WebSocket.OPEN) {
    console.log('Waiting for WebSocket connection to open...');
    return;  // Prevent sending offer before WebSocket is ready
  }

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const callId = Math.random().toString(36).substring(2, 15);
  callInput.value = callId;

  socket.send(JSON.stringify({
    type: 'offer',
    callId: callId,
    offer: offerDescription.sdp
  }));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({
        type: 'candidate',
        callId: callId,
        candidate: event.candidate.toJSON(),
        candidateType: 'offer'
      }));
    }
  };

  hangupButton.disabled = false;
};

// Answer the call (no change here)
answerButton.onclick = async () => {
  if (socket.readyState !== WebSocket.OPEN) {
    console.log('Waiting for WebSocket connection to open...');
    return;  // Prevent sending before WebSocket is ready
  }

  const callId = callInput.value;
  socket.send(JSON.stringify({ type: 'get-offer', callId: callId }));

  socket.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    if (data.type === 'offer') {
      const offerDescription = new RTCSessionDescription({
        type: 'offer',
        sdp: data.offer
      });
      await pc.setRemoteDescription(offerDescription);

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      socket.send(JSON.stringify({
        type: 'answer',
        callId: callId,
        answer: answerDescription.sdp
      }));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.send(JSON.stringify({
            type: 'candidate',
            callId: callId,
            candidate: event.candidate.toJSON(),
            candidateType: 'answer'
          }));
        }
      };
    }
  };
};


window.onload = connectToWebSocket;