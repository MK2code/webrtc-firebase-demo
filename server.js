const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const wss = new WebSocket.Server({ port: 8080 });

let db = new sqlite3.Database('./webrtc_signaling.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

db.run(`
  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    offer TEXT,
    answer TEXT
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS candidates (
    callId TEXT,
    candidate TEXT,
    type TEXT
  );
`);

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'offer') {
      const callId = data.callId;
      const offer = data.offer;

      db.run(`INSERT INTO calls (id, offer) VALUES (?, ?)`, [callId, offer], (err) => {
        if (err) {
          console.error(err.message);
        }
        ws.send(JSON.stringify({ type: 'offer-stored', callId: callId }));
      });

    } else if (data.type === 'answer') {
      const callId = data.callId;
      const answer = data.answer;

      db.run(`UPDATE calls SET answer = ? WHERE id = ?`, [answer, callId], (err) => {
        if (err) {
          console.error(err.message);
        }
        ws.send(JSON.stringify({ type: 'answer-stored', callId: callId }));
      });

    } else if (data.type === 'candidate') {
      const callId = data.callId;
      const candidate = data.candidate;
      const candidateType = data.candidateType;

      db.run(`INSERT INTO candidates (callId, candidate, type) VALUES (?, ?, ?)`, [callId, candidate, candidateType], (err) => {
        if (err) {
          console.error(err.message);
        }
        ws.send(JSON.stringify({ type: 'candidate-stored', callId: callId }));
      });
    }

    // Fetch the offer for a given callId
    else if (data.type === 'get-offer') {
      const callId = data.callId;

      db.get(`SELECT offer FROM calls WHERE id = ?`, [callId], (err, row) => {
        if (err) {
          console.error(err.message);
        } else {
          ws.send(JSON.stringify({ type: 'offer', offer: row.offer }));
        }
      });
    }

    // Fetch the answer for a given callId
    else if (data.type === 'get-answer') {
      const callId = data.callId;

      db.get(`SELECT answer FROM calls WHERE id = ?`, [callId], (err, row) => {
        if (err) {
          console.error(err.message);
        } else {
          ws.send(JSON.stringify({ type: 'answer', answer: row.answer }));
        }
      });
    }
  });
});
