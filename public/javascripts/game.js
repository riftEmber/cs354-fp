$(document).ready(function () {
    const SECOND = 1000;

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
            console.error("cannot send following message as WebSocket is not open", jsonMessage);
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
                    $(`#square-${jsonMessage.data["index"]}`).css({
                        "background-color": squareColor,
                        "color": (squareColor === "black" ? "white" : "black")
                    });
                }
                break;
            case "hello":
                if (userID <= 0) {
                    userID = jsonMessage.userID;
                }
                if (typeof jsonMessage.data !== "undefined") {
                    prepareBoard(jsonMessage.data);
                }
                break;
            case "pong":
                break;
            case "gameFull":
                console.error("cannot join game, it is already running!");
                conn.close();
                break;
            default:
                console.error(`illegal game update type ${jsonMessage.updateType}`)
        }
    }

    function prepareBoard(gameData) {
        let dim = Math.sqrt(Object.keys(gameData).length);
        let board = $("#board");
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

        $(".square").click(function () {
            sendGameUpdate("guess", {index: parseInt($(this).attr("id").replace("square-", ""))});
        });
    }

    let userID = -1;


    console.log("client-side game code loaded");
});