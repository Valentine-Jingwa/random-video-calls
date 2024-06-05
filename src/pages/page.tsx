'use client';
import { useEffect, useState } from 'react';
import { firestore } from '../lib/firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import Peer, { MediaConnection } from 'peerjs';

const Home = () => {
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [call, setCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(true);

  useEffect(() => {
    const peerInstance = new Peer();
    setPeer(peerInstance);

    peerInstance.on('open', async (id: string) => {
      setPeerId(id);
      // Save the peerId to Firestore
      await addDoc(collection(firestore, 'rooms'), { peerId: id });
    });

    peerInstance.on('call', (callInstance: MediaConnection) => {
      setCall(callInstance);
      setIsConnecting(false);
      // Answer the call with the user's media stream
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setLocalStream(stream);
          callInstance.answer(stream);
          callInstance.on('stream', (remoteStream: MediaStream) => {
            // Display the remote video stream
            const videoElement = document.getElementById('remote-video') as HTMLVideoElement;
            videoElement.srcObject = remoteStream;
            videoElement.play();
          });
        });
    });

    return () => peerInstance.destroy();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firestore, 'rooms'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const { peerId: newPeerId } = change.doc.data();
          if (newPeerId !== peerId) {
            setRemotePeerId(newPeerId);
            setIsConnecting(false);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [peerId]);

  const makeCall = () => {
    setIsConnecting(false);
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        const callInstance = peer?.call(remotePeerId, stream);
        if (callInstance) {
          callInstance.on('stream', (remoteStream: MediaStream) => {
            // Display the remote video stream
            const videoElement = document.getElementById('remote-video') as HTMLVideoElement;
            videoElement.srcObject = remoteStream;
            videoElement.play();
          });
        }
      });
  };

  const endCall = () => {
    call?.close();
    setCall(null);
  };

  const sendMessage = () => {
    if (message.trim()) {
      setChatMessages([...chatMessages, `Me: ${message}`]);
      // Send the message to the remote peer (implement the sending part here)
      setMessage('');
    }
  };

  if (isConnecting) {
    return (
      <div className="connecting-animation">
        Connecting...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <h1 className="text-4xl font-bold mb-8">Random Video Call</h1>
      <div className="flex items-center mb-4">
        <input
          type="text"
          value={remotePeerId}
          onChange={(e) => setRemotePeerId(e.target.value)}
          placeholder="Enter a username"
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md mr-2"
        />
        <button onClick={makeCall} className="px-4 py-2 bg-blue-500 text-white rounded-md mr-2">Call</button>
        <button onClick={endCall} className="px-4 py-2 bg-red-500 text-white rounded-md">End Call</button>
      </div>
      <div className="relative w-full max-w-2xl mb-4">
        <video id="remote-video" autoPlay className="w-full h-auto rounded-md shadow-md"></video>
        {localStream && (
          <video
            autoPlay
            muted
            className="absolute bottom-4 right-4 w-32 h-32 rounded-md border-2 border-white"
            ref={(video) => {
              if (video) video.srcObject = localStream;
            }}
          ></video>
        )}
      </div>
      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-2">Chat</h2>
        <div className="max-h-48 overflow-y-scroll border border-gray-300 dark:border-gray-700 rounded-md p-2 mb-2">
          {chatMessages.map((msg, index) => (
            <div key={index} className="mb-1">{msg}</div>
          ))}
        </div>
        <div className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md mr-2"
          />
          <button onClick={sendMessage} className="px-4 py-2 bg-green-500 text-white rounded-md">Send</button>
        </div>
      </div>
    </div>
  );
};

export default Home;
