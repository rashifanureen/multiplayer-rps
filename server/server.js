const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = {};


// ================================
// BASIC SERVER CHECK
// ================================

app.get("/", (req, res) => {
    res.send("Multiplayer RPS Server is running!");
});


// ================================
// CREATE ROOM CODE
// ================================

function generateRoomCode() {

    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += characters[Math.floor(Math.random() * characters.length)];
    }

    return rooms[code] ? generateRoomCode() : code;
}


// ================================
// GET PUBLIC PLAYER DATA
// ================================

function getPlayers(room) {

    return room.players.map(player => ({
        id: player.id,
        name: player.name,
        score: player.score,
        ready: player.choice !== null
    }));
}


// ================================
// DETERMINE ROUND WINNER
// ================================

function getRoundWinner(choice1, choice2) {

    if (choice1 === choice2) {
        return "draw";
    }

    if (
        (choice1 === "rock" && choice2 === "scissors") ||
        (choice1 === "paper" && choice2 === "rock") ||
        (choice1 === "scissors" && choice2 === "paper")
    ) {
        return "player1";
    }

    return "player2";
}


// ================================
// SOCKET CONNECTION
// ================================

io.on("connection", (socket) => {

    console.log("Player connected:", socket.id);


    // ================================
    // CREATE ROOM
    // ================================

    socket.on("createRoom", ({ name }) => {

        if (!name || !name.trim()) {
            socket.emit("roomError", "Please enter a valid name.");
            return;
        }

        const roomCode = generateRoomCode();

        rooms[roomCode] = {
            players: [
                {
                    id: socket.id,
                    name: name.trim(),
                    score: 0,
                    choice: null
                }
            ],
            round: 1,
            gameOver: false
        };

        socket.join(roomCode);

        socket.roomCode = roomCode;

        socket.emit("roomCreated", {
            roomCode: roomCode
        });

        console.log(`Room ${roomCode} created by ${name}`);
    });


    // ================================
    // JOIN ROOM
    // ================================

    socket.on("joinRoom", ({ name, roomCode }) => {

        if (!name || !name.trim()) {
            socket.emit("roomError", "Please enter a valid name.");
            return;
        }

        if (!roomCode) {
            socket.emit("roomError", "Please enter a room code.");
            return;
        }

        const code = roomCode.trim().toUpperCase();

        const room = rooms[code];

        if (!room) {
            socket.emit("roomError", "Room not found.");
            return;
        }

        if (room.players.length >= 2) {
            socket.emit("roomError", "This room is already full.");
            return;
        }

        room.players.push({
            id: socket.id,
            name: name.trim(),
            score: 0,
            choice: null
        });

        socket.join(code);

        socket.roomCode = code;


        io.to(code).emit("playerJoined", {
            roomCode: code,
            players: getPlayers(room)
        });

        io.to(code).emit("gameStarted", {
            players: getPlayers(room)
        });

        console.log(`${name} joined room ${code}`);
    });


    // ================================
    // MAKE MOVE
    // ================================

    socket.on("makeMove", ({ roomCode, choice }) => {

        const room = rooms[roomCode];

        if (!room) {
            return;
        }

        if (room.gameOver) {
            return;
        }

        const validChoices = [
            "rock",
            "paper",
            "scissors"
        ];

        if (!validChoices.includes(choice)) {
            return;
        }

        const player = room.players.find(
            p => p.id === socket.id
        );

        if (!player) {
            return;
        }

        // Prevent changing the choice
        // after selecting it
        if (player.choice !== null) {
            return;
        }

        player.choice = choice;


        io.to(roomCode).emit("moveMade", {
            playerId: socket.id
        });


        // Wait until both players choose
        if (room.players.length < 2) {
            return;
        }

        if (
            room.players[0].choice === null ||
            room.players[1].choice === null
        ) {
            return;
        }


        // ================================
        // CALCULATE ROUND
        // ================================

        const player1 = room.players[0];
        const player2 = room.players[1];

        const result = getRoundWinner(
            player1.choice,
            player2.choice
        );


        let message = "";

        if (result === "player1") {

            player1.score++;

            message =
                `${player1.name} wins the round!`;

        } else if (result === "player2") {

            player2.score++;

            message =
                `${player2.name} wins the round!`;

        } else {

            message = "It's a draw!";
        }


        io.to(roomCode).emit("roundResult", {

            result:
                result === "draw"
                    ? "🤝 Draw!"
                    : result === "player1"
                        ? "🎉 Player 1 Wins!"
                        : "🎉 Player 2 Wins!",

            message: message,

            player1Choice: player1.choice,

            player2Choice: player2.choice,

            scores: {
                player1: player1.score,
                player2: player2.score
            },

            round: room.round
        });


        // ================================
        // CHECK GAME OVER
        // ================================

        if (
            player1.score >= 5 ||
            player2.score >= 5
        ) {

            room.gameOver = true;

            const winner =
                player1.score >= 5
                    ? player1.name
                    : player2.name;

            io.to(roomCode).emit("gameOver", {
                winner: winner
            });

            return;
        }


        // ================================
        // NEXT ROUND
        // ================================

        room.round++;

        player1.choice = null;
        player2.choice = null;

        setTimeout(() => {

            if (!rooms[roomCode]) {
                return;
            }

            io.to(roomCode).emit("nextRound", {
                round: room.round
            });

        }, 1500);
    });


    // ================================
    // PLAY AGAIN
    // ================================

    socket.on("playAgain", ({ roomCode }) => {

        const room = rooms[roomCode];

        if (!room) {
            return;
        }

        room.players.forEach(player => {

            player.score = 0;
            player.choice = null;

        });

        room.round = 1;
        room.gameOver = false;


        io.to(roomCode).emit("gameReset", {
            round: 1
        });
    });


    // ================================
    // LEAVE ROOM
    // ================================

    socket.on("leaveRoom", () => {

        leaveRoom(socket);
    });


    // ================================
    // DISCONNECT
    // ================================

    socket.on("disconnect", () => {

        console.log("Player disconnected:", socket.id);

        leaveRoom(socket);
    });
});


// ================================
// LEAVE ROOM FUNCTION
// ================================

function leaveRoom(socket) {

    const roomCode = socket.roomCode;

    if (!roomCode) {
        return;
    }

    const room = rooms[roomCode];

    if (!room) {
        return;
    }

    room.players = room.players.filter(
        player => player.id !== socket.id
    );


    socket.leave(roomCode);

    socket.roomCode = null;


    if (room.players.length === 0) {

        delete rooms[roomCode];

        console.log(`Room ${roomCode} deleted.`);

        return;
    }


    io.to(roomCode).emit(
        "playerDisconnected",
        "The other player has left the game."
    );
}


// ================================
// START SERVER
// ================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );
});