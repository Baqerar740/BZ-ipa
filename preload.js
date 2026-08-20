"use strict";

/*
|--------------------------------------------------------------------------
| BAQEZU HUB - PRELOAD.JS
|--------------------------------------------------------------------------
| Secure bridge between Renderer and Main Process.
|
| Supports:
| - Dynamic games
| - Game password
| - Create account
| - Login
| - Link account
| - Refresh account
| - Unlink account
| - Remove local game data
| - Open game
| - Open game with password
|--------------------------------------------------------------------------
*/

const {
    contextBridge,
    ipcRenderer
} = require("electron");


/*
|--------------------------------------------------------------------------
| IPC INVOKE
|--------------------------------------------------------------------------
*/

async function invoke(channel, ...args) {

    try {

        return await ipcRenderer.invoke(
            channel,
            ...args
        );

    } catch (error) {

        console.error(
            "[BAQEZU IPC ERROR]",
            channel,
            error
        );

        return {

            success: false,

            error: "ipc_error",

            message:
                error &&
                error.message
                    ? error.message
                    : "حدث خطأ أثناء الاتصال بالتطبيق."

        };

    }

}


/*
|--------------------------------------------------------------------------
| STRING HELPERS
|--------------------------------------------------------------------------
*/

function cleanString(
    value,
    maxLength = 500
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);

}


/*
|--------------------------------------------------------------------------
| USERNAME
|--------------------------------------------------------------------------
*/

function cleanUsername(username) {

    return cleanString(
        username,
        60
    );

}


/*
|--------------------------------------------------------------------------
| PASSWORD
|--------------------------------------------------------------------------
|
| مهم:
| لا نستخدم trim() لكلمة المرور.
|
| حتى تكون:
|
| "123 456"
|
| مختلفة عن:
|
| "123456"
|
|--------------------------------------------------------------------------
*/

function cleanPassword(password) {

    if (
        password === null ||
        password === undefined
    ) {
        return "";
    }

    return String(password)
        .slice(0, 200);

}


/*
|--------------------------------------------------------------------------
| GAME ID
|--------------------------------------------------------------------------
*/

function cleanGameId(gameId) {

    const value =
        cleanString(
            gameId,
            100
        );

    if (!value) {
        return "";
    }

    return value
        .replace(
            /[^a-zA-Z0-9_-]/g,
            ""
        )
        .slice(0, 100);

}


/*
|--------------------------------------------------------------------------
| VALIDATE GAME ID
|--------------------------------------------------------------------------
*/

function validateGameId(gameId) {

    const cleanId =
        cleanGameId(gameId);

    if (!cleanId) {

        return {

            success: false,

            error:
                "missing_game_id",

            message:
                "معرف اللعبة غير صالح."

        };

    }

    return {

        success: true,

        gameId: cleanId

    };

}


/*
|--------------------------------------------------------------------------
| VALIDATE USERNAME
|--------------------------------------------------------------------------
*/

function validateUsername(username) {

    const cleanUser =
        cleanUsername(username);

    if (!cleanUser) {

        return {

            success: false,

            error:
                "missing_username",

            message:
                "يرجى كتابة اسم اللاعب."

        };

    }

    return {

        success: true,

        username: cleanUser

    };

}


/*
|--------------------------------------------------------------------------
| VALIDATE PASSWORD
|--------------------------------------------------------------------------
*/

function validatePassword(password) {

    const cleanPass =
        cleanPassword(password);

    if (cleanPass === "") {

        return {

            success: false,

            error:
                "missing_password",

            message:
                "يرجى كتابة كلمة المرور."

        };

    }

    return {

        success: true,

        password: cleanPass

    };

}


/*
|--------------------------------------------------------------------------
| VALIDATE GAME + USERNAME
|--------------------------------------------------------------------------
*/

function validateCredentials(
    gameId,
    username
) {

    const gameValidation =
        validateGameId(gameId);

    if (!gameValidation.success) {
        return gameValidation;
    }

    const usernameValidation =
        validateUsername(username);

    if (!usernameValidation.success) {
        return usernameValidation;
    }

    return {

        success: true,

        gameId:
            gameValidation.gameId,

        username:
            usernameValidation.username

    };

}


/*
|--------------------------------------------------------------------------
| BAQEZU API
|--------------------------------------------------------------------------
*/

const baqezuApi = {


    /*
    |--------------------------------------------------------------------------
    | GET ALL GAMES
    |--------------------------------------------------------------------------
    */

    getGames:
        async function () {

            return await invoke(
                "app:get-games"
            );

        },


    /*
    |--------------------------------------------------------------------------
    | REFRESH GAMES
    |--------------------------------------------------------------------------
    */

    refreshGames:
        async function () {

            return await invoke(
                "app:refresh-games"
            );

        },


    /*
    |--------------------------------------------------------------------------
    | GET ONE GAME
    |--------------------------------------------------------------------------
    */

    getGame:
        async function (gameId) {

            const validation =
                validateGameId(gameId);

            if (!validation.success) {
                return validation;
            }

            return await invoke(
                "app:get-game",
                validation.gameId
            );

        },


    /*
    |--------------------------------------------------------------------------
    | GET LINKED GAMES
    |--------------------------------------------------------------------------
    */

    getLinkedGames:
        async function () {

            return await invoke(
                "app:get-linked-games"
            );

        },


    /*
    |--------------------------------------------------------------------------
    | CREATE GAME ACCOUNT
    |--------------------------------------------------------------------------
    |
    | يستخدم عند إنشاء حساب جديد.
    |
    | يرسل:
    |
    | gameId
    | username
    | password
    |
    |--------------------------------------------------------------------------
    */

    createGameAccount:
        async function (
            gameId,
            username,
            password = ""
        ) {

            const validation =
                validateCredentials(
                    gameId,
                    username
                );

            if (!validation.success) {
                return validation;
            }

            const cleanPass =
                cleanPassword(password);

            return await invoke(

                "game:create-account",

                validation.gameId,

                validation.username,

                cleanPass

            );

        },


    /*
    |--------------------------------------------------------------------------
    | LINK GAME
    |--------------------------------------------------------------------------
    |
    | إذا اللعبة بدون كلمة مرور:
    |
    | password = ""
    |
    | وإذا اللعبة تحتاج كلمة مرور:
    |
    | password = كلمة المرور
    |
    |--------------------------------------------------------------------------
    */

    linkGame:
        async function (
            gameId,
            username,
            password = ""
        ) {

            const validation =
                validateCredentials(
                    gameId,
                    username
                );

            if (!validation.success) {
                return validation;
            }

            const cleanPass =
                cleanPassword(password);

            return await invoke(

                "game:link",

                validation.gameId,

                validation.username,

                cleanPass

            );

        },


    /*
    |--------------------------------------------------------------------------
    | LOGIN GAME
    |--------------------------------------------------------------------------
    */

    loginGame:
        async function (
            gameId,
            username,
            password
        ) {

            const validation =
                validateCredentials(
                    gameId,
                    username
                );

            if (!validation.success) {
                return validation;
            }

            const passwordValidation =
                validatePassword(password);

            if (!passwordValidation.success) {
                return passwordValidation;
            }

            return await invoke(

                "game:login",

                validation.gameId,

                validation.username,

                passwordValidation.password

            );

        },


    /*
    |--------------------------------------------------------------------------
    | AUTHENTICATE GAME
    |--------------------------------------------------------------------------
    |
    | Alias إضافي لتسهيل استخدام الواجهة.
    |
    |--------------------------------------------------------------------------
    */

    authenticateGame:
        async function (
            gameId,
            credentials = {}
        ) {

            const username =
                credentials &&
                credentials.username !== undefined
                    ? credentials.username
                    : "";

            const password =
                credentials &&
                credentials.password !== undefined
                    ? credentials.password
                    : "";

            return await baqezuApi.loginGame(
                gameId,
                username,
                password
            );

        },


    /*
    |--------------------------------------------------------------------------
    | REFRESH GAME ACCOUNT
    |--------------------------------------------------------------------------
    */

    refreshGame:
        async function (gameId) {

            const validation =
                validateGameId(gameId);

            if (!validation.success) {
                return validation;
            }

            return await invoke(

                "game:refresh",

                validation.gameId

            );

        },


    /*
    |--------------------------------------------------------------------------
    | UNLINK GAME
    |--------------------------------------------------------------------------
    */

    unlinkGame:
        async function (gameId) {

            const validation =
                validateGameId(gameId);

            if (!validation.success) {
                return validation;
            }

            return await invoke(

                "game:unlink",

                validation.gameId

            );

        },


    /*
    |--------------------------------------------------------------------------
    | REMOVE LOCAL GAME DATA
    |--------------------------------------------------------------------------
    */

    removeGameData:
        async function (gameId) {

            const validation =
                validateGameId(gameId);

            if (!validation.success) {
                return validation;
            }

            return await invoke(

                "game:remove-local-data",

                validation.gameId

            );

        },


    /*
    |--------------------------------------------------------------------------
    | OPEN GAME
    |--------------------------------------------------------------------------
    */

    openGame:
        async function (gameId) {

            const validation =
                validateGameId(gameId);

            if (!validation.success) {
                return validation;
            }

            return await invoke(

                "game:open",

                validation.gameId

            );

        },


    /*
    |--------------------------------------------------------------------------
    | OPEN GAME WITH PASSWORD
    |--------------------------------------------------------------------------
    |
    | 1. Login
    | 2. حفظ Token
    | 3. فتح اللعبة
    |
    |--------------------------------------------------------------------------
    */

    openGameWithPassword:
        async function (
            gameId,
            username,
            password
        ) {

            const loginResult =
                await baqezuApi.loginGame(

                    gameId,

                    username,

                    password

                );

            if (
                !loginResult ||
                !loginResult.success
            ) {

                return (
                    loginResult || {

                        success: false,

                        error:
                            "login_failed",

                        message:
                            "فشل تسجيل الدخول."

                    }
                );

            }

            return await baqezuApi.openGame(
                gameId
            );

        },


    /*
    |--------------------------------------------------------------------------
    | CLEAR ALL DATA
    |--------------------------------------------------------------------------
    */

    clearData:
        async function () {

            return await invoke(
                "app:clear-data"
            );

        },


    /*
    |--------------------------------------------------------------------------
    | BACKWARD COMPATIBILITY
    |--------------------------------------------------------------------------
    */


    /*
    | LUDO CREATE
    */

    createLudoAccount:
        async function (
            username,
            password = ""
        ) {

            return await baqezuApi.createGameAccount(

                "ludo_game",

                username,

                password

            );

        },


    /*
    | LUDO LINK
    */

    linkLudo:
        async function (
            username,
            password = ""
        ) {

            return await baqezuApi.linkGame(

                "ludo_game",

                username,

                password

            );

        },


    /*
    | LUDO LOGIN
    */

    loginLudo:
        async function (
            username,
            password
        ) {

            return await baqezuApi.loginGame(

                "ludo_game",

                username,

                password

            );

        },


    /*
    | LUDO REFRESH
    */

    refreshLudo:
        async function () {

            return await baqezuApi.refreshGame(
                "ludo_game"
            );

        },


    /*
    | LUDO UNLINK
    */

    unlinkLudo:
        async function () {

            return await baqezuApi.unlinkGame(
                "ludo_game"
            );

        },


    /*
    | LUDO OPEN
    */

    openLudo:
        async function () {

            return await baqezuApi.openGame(
                "ludo_game"
            );

        },


    /*
    |--------------------------------------------------------------------------
    | SNAKE & LADDER HELPERS
    |--------------------------------------------------------------------------
    */

    createSnakeLadderAccount:
        async function (
            username,
            password = ""
        ) {

            return await baqezuApi.createGameAccount(

                "snake_ladder",

                username,

                password

            );

        },


    linkSnakeLadder:
        async function (
            username,
            password = ""
        ) {

            return await baqezuApi.linkGame(

                "snake_ladder",

                username,

                password

            );

        },


    loginSnakeLadder:
        async function (
            username,
            password
        ) {

            return await baqezuApi.loginGame(

                "snake_ladder",

                username,

                password

            );

        },


    refreshSnakeLadder:
        async function () {

            return await baqezuApi.refreshGame(
                "snake_ladder"
            );

        },


    unlinkSnakeLadder:
        async function () {

            return await baqezuApi.unlinkGame(
                "snake_ladder"
            );

        },


    openSnakeLadder:
        async function () {

            return await baqezuApi.openGame(
                "snake_ladder"
            );

        }

};


/*
|--------------------------------------------------------------------------
| EXPOSE API
|--------------------------------------------------------------------------
|
| window.baqezu
|
|--------------------------------------------------------------------------
*/

contextBridge.exposeInMainWorld(

    "baqezu",

    Object.freeze(
        baqezuApi
    )

);


/*
|--------------------------------------------------------------------------
| READY
|--------------------------------------------------------------------------
*/

console.log(
    "BAQEZU HUB Preload Ready - Password System Enabled"
);