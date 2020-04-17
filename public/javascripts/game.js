$(document).ready(function () {
    const SECOND = 1000;
    const REQUIRED_PLAYERS = 4;

    if (!("WebSocket" in window)) {
        console.log("A browser supporting WebSockets is required");
        return;
    }
    const url = $("#game-script").attr("ws-url");
    let conn = new WebSocket(url);

    conn.onopen = function (event) {
        console.log("ws connection established");
        sendGameUpdate("hello")
        setInterval(() => sendGameUpdate("ping"), 20 * SECOND);
    };

    conn.onmessage = (messageEvent) => receiveGameResponse(JSON.parse(messageEvent.data));

    conn.onclose = function (closeEvent) {
        if (closeEvent.wasClean) {
            console.log(`connection closed cleanly, code=${closeEvent.code} reason=${closeEvent.reason}`);
        } else {
            console.log(`connection closed unexpectedly, code=${closeEvent.code}`);
        }
    };

    conn.onerror = (error) => console.log(error);

    $(window).on('beforeunload', function () {
        sendGameUpdate("bye")
        conn.close();
    });

    function sendGameUpdate(updateType, data = null) {
        const jsonMessage = {updateType: updateType, userID: userID, data: data}
        if (conn.readyState !== WebSocket.OPEN) {
            console.error("cannot send message as WebSocket is not open", jsonMessage);
            return;
        }
        const message = JSON.stringify(jsonMessage)
        console.log("sending message to server:", jsonMessage);
        conn.send(message);
    }

    function receiveGameResponse(jsonMessage) {
        console.log("received message from server:", jsonMessage);
        switch (jsonMessage.updateType) {
            case "guessResult":
                console.log(jsonMessage.data);
                if (jsonMessage.data["valid"]) {
                    const squareColor = jsonMessage.data["color"].toLowerCase();
                    const square = $(`#square-${jsonMessage.data["index"]}`);
                    square.css({
                        "background-color": squareColor,
                        "color": (squareColor === "black" ? "white" : "black")
                    });
                    square.text("");
                }
                break;
            case "hello":
                if (userID <= 0) {
                    userID = jsonMessage.userID;
                }
                if (jsonMessage.data["data"] != null) {
                    prepareBoard(jsonMessage.data["data"]);
                }
                updatePlayers(jsonMessage.data["players"]);
                break;
            case "bye":
                updatePlayers(jsonMessage.data["players"]);
                if (jsonMessage.data["stopGame"]) {
                    notifyPlayer("Game aborted due to player disconnect");
                }
                break;
            case "pong":
                break;
            case "gameFull":
                if (jsonMessage.userID === userID) {
                    console.error("cannot join game, it is already running!");
                    conn.close();
                }
                break;
            default:
                console.error(`illegal game update type ${jsonMessage.updateType}`)
        }
    }

    function updatePlayers(playerInfo) {
        console.log("player info:", playerInfo);
        const playerTable = $("#players");
        let playerHTML = "";
        playerHTML += "<tr><th>Players</th></tr>";
        for (let i = 0; i < REQUIRED_PLAYERS; i++) {
            if (`${i}` in playerInfo) {
                const info = playerInfo[i];
                playerHTML += `<tr class="player" style="background-color: ${info.color.toLowerCase()}">`;
                playerHTML += `<td>${i + 1}: ${info.userID} - ${info.role === "GUESSER" ? "Guesser" : "Clue-giver"}${info.userID === userID ? " (you)" : ""}</td>`
            } else {
                playerHTML += '<tr class="player">';
                playerHTML += `<td class="placeholder">${i + 1}: waiting for player...</td>`;
            }
            playerHTML += "</tr>";
        }
        playerTable.html(playerHTML);
    }

    function prepareBoard(gameData) {
        const dim = Math.sqrt(Object.keys(gameData).length);
        const board = $("#board");
        board.html("");
        board.hide();
        let row = "";
        for (let i = 0; i < dim ** 2; i++) {
            if (i % dim === 0) {
                // start new row
                if (i > 0) {
                    row += "</tr>";
                    board.append(row);
                }
                row = "<tr>";
            }
            row += `<td id="square-${i}" class="square">${gameData[i]["word"]}</td>`;
        }
        row += "</tr>";
        board.append(row);
        board.fadeIn();

        const squares = $(".square");
        squares.css({"min-width": `${100 / dim}%`});
        squares.click(function () {
            sendGameUpdate("guess", {index: parseInt($(this).attr("id").replace("square-", ""))});
        });

        notifyPlayer("Beginning a new game");
    }

    function notifyPlayer(message) {
        const notifyBar = $("#notification");
        notifyBar.text(message);
        notifyBar.show();
        setTimeout(function () {
            notifyBar.fadeOut();
        }, 2.5 * SECOND);
    }

    let userID = -1;


    notifyPlayer("Game loaded");
});