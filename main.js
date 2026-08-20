"use strict";

const {
    app,
    BrowserWindow,
    ipcMain,
    session
} = require("electron");

const path = require("path");

const StoreImport = require("electron-store");
const Store = StoreImport.default || StoreImport;

const store = new Store({
    name: "baqezu-hub-data"
});

/* =========================================================
   BAQEZU HUB
   UNIVERSAL GAME LOADER
   =========================================================

   يدعم:

   1. ألعاب تحتاج حساب HUB
   2. ألعاب لديها حساب خارجي
   3. ألعاب لا تحتاج حساب
   4. ألعاب لديها API
   5. ألعاب لا تحتوي API
   6. ألعاب لا تحتوي action=info
   7. HTTP / HTTPS
   8. JavaScript
   9. WebSocket
   10. SPA
   11. تغيّر الرابط داخلياً
   12. Redirect
   13. ألعاب قديمة وحديثة
   14. Sessions مستقلة لكل لعبة
   15. حفظ الحسابات محلياً
   16. Cache لقائمة الألعاب
   17. فتح الألعاب مباشرة
   18. دعم window.open
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const GAMES_CONFIG_URL =
    "https://minezu.free.nf/games_api.php";

const GAMES_CACHE_KEY =
    "remoteGamesCache";

const GAMES_CACHE_TIME_KEY =
    "remoteGamesCacheTime";

const LINKED_GAMES_KEY =
    "linkedGames";

const CONFIG_PARTITION =
    "persist:baqezu-games-config";

const CHROME_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/151.0.0.0 Safari/537.36";


/* =========================================================
   WINDOWS
========================================================= */

let mainWindow = null;
let configWindow = null;

const apiWindows = new Map();
const gameWindows = new Map();

let configRequestPromise = null;


/* =========================================================
   HELPERS
========================================================= */

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function safeString(value, fallback = "") {
    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    return String(value);
}


function isDestroyed(win) {
    return (
        !win ||
        win.isDestroyed()
    );
}


function removeBom(text) {
    return safeString(text)
        .replace(/^\uFEFF/, "");
}


function toBoolean(value, fallback = false) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "TRUE" ||
        value === "yes" ||
        value === "YES"
    ) {
        return true;
    }

    if (
        value === false ||
        value === 0 ||
        value === "0" ||
        value === "false" ||
        value === "FALSE" ||
        value === "no" ||
        value === "NO"
    ) {
        return false;
    }

    return fallback;
}


/* =========================================================
   URL HELPERS
========================================================= */

function normalizeUrl(url) {
    try {
        const u = new URL(url);

        return (
            u.origin +
            u.pathname.replace(/\/+$/, "")
        ).toLowerCase();

    } catch {
        return safeString(url)
            .replace(/\/+$/, "")
            .toLowerCase();
    }
}


function sameOrigin(url1, url2) {
    try {
        return (
            new URL(url1).origin ===
            new URL(url2).origin
        );

    } catch {
        return false;
    }
}


function isHttpUrl(url) {
    try {
        const protocol =
            new URL(url).protocol;

        return (
            protocol === "http:" ||
            protocol === "https:"
        );

    } catch {
        return false;
    }
}


/* =========================================================
   PASSWORD
========================================================= */

function detectPasswordRequirement(game) {

    if (
        !game ||
        typeof game !== "object"
    ) {
        return false;
    }

    return (
        toBoolean(game.hasPassword) ||
        toBoolean(game.has_password) ||

        toBoolean(game.passwordRequired) ||
        toBoolean(game.password_required) ||

        toBoolean(game.requiresPassword) ||
        toBoolean(game.requires_password) ||

        toBoolean(game.needPassword) ||
        toBoolean(game.need_password) ||

        toBoolean(game.passwordEnabled) ||
        toBoolean(game.password_enabled) ||

        toBoolean(game.requiresGamePassword) ||
        toBoolean(game.requires_game_password)
    );
}


/* =========================================================
   ACCOUNT SYSTEM
========================================================= */

function getAccountSystem(game) {

    const value =
        safeString(
            game &&
            (
                game.accountSystem ||
                game.account_system
            ) ||
            "none"
        )
        .trim()
        .toLowerCase();

    if (
        value === "hub" ||
        value === "external" ||
        value === "none"
    ) {
        return value;
    }

    return "none";
}


function gameRequiresLogin(game) {

    if (!game) {
        return false;
    }

    if (
        game.requiresLogin === true ||
        game.requires_login === true
    ) {
        return true;
    }

    const account =
        getAccountSystem(game);

    return (
        account === "hub" ||
        account === "external"
    );
}


/* =========================================================
   PROTECTION DETECTOR
========================================================= */

function isProtectionPage(text) {

    const content =
        safeString(text)
            .toLowerCase();

    return (
        content.includes("slowaes.decrypt") ||

        (
            content.includes("__test") &&
            content.includes("aes.js")
        ) ||

        content.includes(
            "this site requires javascript"
        ) ||

        content.includes(
            'src="/aes.js"'
        ) ||

        content.includes(
            "enable javascript"
        ) ||

        (
            content.includes("javascript") &&
            content.includes("enable") &&
            content.includes("browser")
        )
    );
}


/* =========================================================
   JSON PARSER
========================================================= */

function parseJsonResponse(text, sourceName) {

    let clean =
        removeBom(text).trim();

    if (!clean) {
        throw new Error(
            sourceName +
            " أعاد استجابة فارغة."
        );
    }

    const objectStart =
        clean.indexOf("{");

    const arrayStart =
        clean.indexOf("[");

    let start = -1;

    if (
        objectStart !== -1 &&
        arrayStart !== -1
    ) {
        start =
            Math.min(
                objectStart,
                arrayStart
            );

    } else if (objectStart !== -1) {

        start = objectStart;

    } else if (arrayStart !== -1) {

        start = arrayStart;
    }

    if (start > 0) {
        clean =
            clean.substring(start);
    }

    try {
        return JSON.parse(clean);

    } catch {

        const lastObject =
            clean.lastIndexOf("}");

        const lastArray =
            clean.lastIndexOf("]");

        const end =
            Math.max(
                lastObject,
                lastArray
            );

        if (end !== -1) {

            try {
                return JSON.parse(
                    clean.substring(
                        0,
                        end + 1
                    )
                );

            } catch {
                // ignore
            }
        }

        throw new Error(
            sourceName +
            " لم يعد JSON صالحاً.\n" +
            clean.substring(0, 1500)
        );
    }
}


/* =========================================================
   MAIN WINDOW
========================================================= */

function createWindow() {

    mainWindow =
        new BrowserWindow({

            width: 1200,
            height: 780,

            minWidth: 950,
            minHeight: 650,

            title:
                "BAQEZU HUB",

            backgroundColor:
                "#090610",

            autoHideMenuBar:
                true,

            webPreferences: {

                preload:
                    path.join(
                        __dirname,
                        "preload.js"
                    ),

                contextIsolation:
                    true,

                nodeIntegration:
                    false,

                sandbox:
                    false
            }
        });

    mainWindow.loadFile(
        path.join(
            __dirname,
            "src",
            "index.html"
        )
    );

    mainWindow.on(
        "closed",
        () => {
            mainWindow = null;
        }
    );
}


/* =========================================================
   APP READY
========================================================= */

app.whenReady()
    .then(() => {

        try {

            const configSession =
                session.fromPartition(
                    CONFIG_PARTITION
                );

            configSession.setUserAgent(
                CHROME_USER_AGENT
            );

        } catch (error) {

            console.warn(
                "CONFIG SESSION ERROR:",
                error.message
            );
        }

        createWindow();

        app.on(
            "activate",
            () => {

                if (
                    BrowserWindow
                        .getAllWindows()
                        .length === 0
                ) {
                    createWindow();
                }
            }
        );
    });


app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {
            app.quit();
        }
    }
);


/* =========================================================
   CONFIG WINDOW
========================================================= */

function createConfigWindow() {

    if (
        configWindow &&
        !configWindow.isDestroyed()
    ) {
        return configWindow;
    }

    configWindow =
        new BrowserWindow({

            show: false,

            width: 1000,
            height: 700,

            webPreferences: {

                contextIsolation:
                    true,

                nodeIntegration:
                    false,

                sandbox:
                    false,

                partition:
                    CONFIG_PARTITION
            }
        });

    configWindow.webContents
        .setUserAgent(
            CHROME_USER_AGENT
        );

    configWindow.on(
        "closed",
        () => {
            configWindow = null;
        }
    );

    return configWindow;
}


/* =========================================================
   READ DOCUMENT
========================================================= */

async function readDocumentText(win) {

    if (isDestroyed(win)) {
        return "";
    }

    try {

        return await win.webContents
            .executeJavaScript(
                `
                (() => {
                    try {
                        return document.documentElement
                            ? (
                                document.documentElement.innerText ||
                                document.documentElement.textContent ||
                                ""
                            )
                            : "";
                    } catch (e) {
                        return "";
                    }
                })();
                `,
                true
            );

    } catch {
        return "";
    }
}


/* =========================================================
   LOAD CONFIG PAGE
========================================================= */

async function loadConfigPage() {

    const win =
        createConfigWindow();

    const separator =
        GAMES_CONFIG_URL.includes("?")
            ? "&"
            : "?";

    const url =
        GAMES_CONFIG_URL +
        separator +
        "_hub=" +
        Date.now();

    try {

        console.log(
            "CONFIG LOAD:",
            url
        );

        await win.loadURL(
            url,
            {
                userAgent:
                    CHROME_USER_AGENT
            }
        );

    } catch (error) {

        if (
            error.code !==
            "ERR_ABORTED"
        ) {

            console.warn(
                "CONFIG LOAD ERROR:",
                error.code ||
                error.message
            );
        }
    }

    await wait(1500);

    let content =
        await readDocumentText(win);

    if (
        isProtectionPage(content)
    ) {

        console.log(
            "CONFIG PROTECTION DETECTED"
        );

        await wait(4500);

        content =
            await readDocumentText(win);
    }

    if (
        isProtectionPage(content)
    ) {

        throw new Error(
            "حماية الاستضافة ما زالت تمنع games_api.php."
        );
    }

    return safeString(content);
}


/* =========================================================
   NORMALIZE GAME
========================================================= */

function normalizeGame(game) {

    if (
        !game ||
        typeof game !== "object"
    ) {
        return null;
    }

    const id =
        safeString(
            game.id
        )
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9_-]/g,
            ""
        );

    const name =
        safeString(
            game.name ||
            game.title ||
            game.displayName ||
            game.display_name
        ).trim();

    const description =
        safeString(
            game.description
        ).trim();

    const icon =
        safeString(
            game.icon,
            "🎮"
        ).trim();

    const image =
        safeString(
            game.image ||
            game.cover ||
            game.imageUrl ||
            game.image_url
        ).trim();

    const apiUrl =
        safeString(
            game.apiUrl ||
            game.api_url
        ).trim();

    const gameUrl =
        safeString(
            game.gameUrl ||
            game.game_url ||
            game.website ||
            game.url ||
            game.playUrl ||
            game.play_url
        ).trim();

    if (
        !id ||
        !name ||
        !gameUrl
    ) {
        return null;
    }

    if (!isHttpUrl(gameUrl)) {
        return null;
    }

    if (
        apiUrl &&
        !isHttpUrl(apiUrl)
    ) {
        return null;
    }

    if (
        game.enabled === false
    ) {
        return null;
    }


    /* ACCOUNT */

    const accountSystem =
        getAccountSystem(game);

    const externalAuth =
        toBoolean(
            game.externalAuth
        ) ||
        toBoolean(
            game.external_auth
        ) ||
        accountSystem === "external";

    let requiresLogin =
        toBoolean(
            game.requiresLogin
        ) ||
        toBoolean(
            game.requires_login
        );

    if (
        accountSystem === "none"
    ) {
        requiresLogin = false;
    }


    /* PASSWORD */

    const hasPassword =
        detectPasswordRequirement(
            game
        );

    const passwordType =
        safeString(
            game.passwordType ||
            game.password_type ||
            (
                hasPassword
                    ? "game"
                    : "none"
            )
        ).trim();

    const passwordField =
        safeString(
            game.passwordField ||
            game.password_field ||
            (
                hasPassword
                    ? "game_password"
                    : ""
            )
        ).trim();

    const passwordLabel =
        safeString(
            game.passwordLabel ||
            game.password_label ||
            (
                hasPassword
                    ? "كلمة المرور"
                    : ""
            )
        ).trim();

    const passwordPlaceholder =
        safeString(
            game.passwordPlaceholder ||
            game.password_placeholder ||
            (
                hasPassword
                    ? "اكتب كلمة المرور..."
                    : ""
            )
        ).trim();

    const passwordMessage =
        safeString(
            game.passwordMessage ||
            game.password_message ||
            (
                hasPassword
                    ? "هذه اللعبة تحتاج كلمة مرور."
                    : ""
            )
        ).trim();


    /* STATUS */

    const status =
        safeString(
            game.status,
            "online"
        )
        .trim()
        .toLowerCase();

    const online =
        game.online !== false;


    /* SORT */

    const nSort =
        Number(game.sort);

    const sort =
        Number.isFinite(nSort)
            ? nSort
            : 999999;


    return {

        ...game,

        id,

        name,

        title:
            safeString(
                game.title,
                name
            ),

        displayName:
            safeString(
                game.displayName ||
                game.display_name ||
                name
            ),

        display_name:
            safeString(
                game.display_name ||
                game.displayName ||
                name
            ),

        description,

        icon,

        image,

        cover:
            safeString(
                game.cover,
                image
            ),

        imageUrl:
            safeString(
                game.imageUrl ||
                game.image_url ||
                image
            ),

        image_url:
            safeString(
                game.image_url ||
                game.imageUrl ||
                image
            ),

        apiUrl,

        api_url:
            apiUrl,

        gameUrl,

        game_url:
            gameUrl,

        url:
            gameUrl,

        playUrl:
            safeString(
                game.playUrl ||
                game.play_url ||
                gameUrl
            ),

        play_url:
            safeString(
                game.play_url ||
                game.playUrl ||
                gameUrl
            ),


        /* ACCOUNT */

        accountSystem,

        account_system:
            accountSystem,

        externalAuth,

        external_auth:
            externalAuth,

        requiresLogin,

        requires_login:
            requiresLogin,


        /* PASSWORD */

        hasPassword,

        has_password:
            hasPassword,

        passwordRequired:
            hasPassword,

        password_required:
            hasPassword,

        requiresPassword:
            hasPassword,

        requires_password:
            hasPassword,

        needPassword:
            hasPassword,

        need_password:
            hasPassword,

        passwordEnabled:
            hasPassword,

        password_enabled:
            hasPassword,

        requiresGamePassword:
            hasPassword,

        requires_game_password:
            hasPassword,

        passwordType,

        password_type:
            passwordType,

        passwordField,

        password_field:
            passwordField,

        passwordLabel,

        password_label:
            passwordLabel,

        passwordPlaceholder,

        password_placeholder:
            passwordPlaceholder,

        passwordMessage,

        password_message:
            passwordMessage,


        /* STATUS */

        status,

        online,

        enabled:
            game.enabled !== false,


        /* UI */

        featured:
            game.featured === true,


        /* VERSION */

        version:
            safeString(
                game.version,
                "1.0.0"
            ),


        /* SORT */

        sort,

        order:
            Number.isFinite(
                Number(game.order)
            )
                ? Number(game.order)
                : sort,


        /* DATES */

        createdAt:
            safeString(
                game.created_at ||
                game.createdAt
            ),

        created_at:
            safeString(
                game.created_at ||
                game.createdAt
            ),

        updatedAt:
            safeString(
                game.updated_at ||
                game.updatedAt
            ),

        updated_at:
            safeString(
                game.updated_at ||
                game.updatedAt
            )
    };
}


/* =========================================================
   NORMALIZE GAMES
========================================================= */

function normalizeGames(games) {

    if (!Array.isArray(games)) {
        return [];
    }

    const result = [];
    const ids = new Set();

    for (const item of games) {

        const game =
            normalizeGame(item);

        if (!game) {
            continue;
        }

        if (
            ids.has(game.id)
        ) {
            continue;
        }

        ids.add(game.id);

        result.push(game);
    }

    result.sort(
        (a, b) => {

            if (
                a.sort !==
                b.sort
            ) {
                return (
                    a.sort -
                    b.sort
                );
            }

            return a.name.localeCompare(
                b.name,
                "ar"
            );
        }
    );

    return result;
}


/* =========================================================
   FETCH REMOTE GAMES
========================================================= */

async function fetchRemoteGames() {

    if (configRequestPromise) {
        return await configRequestPromise;
    }

    configRequestPromise =
        (async () => {

            try {

                const responseText =
                    await loadConfigPage();

                const json =
                    parseJsonResponse(
                        responseText,
                        "games_api.php"
                    );

                let rawGames = null;
                let remoteStore = {};

                if (
                    Array.isArray(json)
                ) {

                    rawGames = json;

                } else if (
                    json &&
                    typeof json === "object"
                ) {

                    if (
                        json.success === false
                    ) {

                        throw new Error(
                            json.message ||
                            json.error ||
                            "games_api success=false"
                        );
                    }

                    if (
                        Array.isArray(
                            json.games
                        )
                    ) {

                        rawGames =
                            json.games;

                    } else if (
                        Array.isArray(
                            json.data
                        )
                    ) {

                        rawGames =
                            json.data;

                    } else if (
                        json.data &&
                        Array.isArray(
                            json.data.games
                        )
                    ) {

                        rawGames =
                            json.data.games;
                    }

                    remoteStore =
                        json.store || {};
                }

                const games =
                    normalizeGames(
                        rawGames
                    );

                if (!games.length) {

                    throw new Error(
                        "لا توجد ألعاب صالحة."
                    );
                }

                const cacheData = {

                    games,

                    store:
                        remoteStore,

                    fetchedAt:
                        new Date()
                            .toISOString(),

                    remoteVersion:
                        json &&
                        json.version !== undefined
                            ? json.version
                            : null
                };

                store.set(
                    GAMES_CACHE_KEY,
                    cacheData
                );

                store.set(
                    GAMES_CACHE_TIME_KEY,
                    Date.now()
                );

                return {

                    ...cacheData,

                    source:
                        "remote"
                };

            } finally {

                configRequestPromise =
                    null;
            }

        })();

    return await configRequestPromise;
}


/* =========================================================
   GET CONFIG
========================================================= */

async function getGamesConfig() {

    try {

        return await fetchRemoteGames();

    } catch (error) {

        console.error(
            "REMOTE GAMES ERROR:",
            error.message
        );

        const cached =
            store.get(
                GAMES_CACHE_KEY,
                null
            );

        if (
            cached &&
            Array.isArray(
                cached.games
            ) &&
            cached.games.length
        ) {

            return {

                ...cached,

                source:
                    "cache",

                warning:
                    "تعذر تحديث قائمة الألعاب، تم استخدام النسخة المحفوظة."
            };
        }

        throw error;
    }
}


/* =========================================================
   FIND GAME
========================================================= */

async function findGame(gameId) {

    const id =
        safeString(gameId)
            .trim()
            .toLowerCase();

    if (!id) {

        throw new Error(
            "معرف اللعبة مفقود."
        );
    }

    const config =
        await getGamesConfig();

    const game =
        config.games.find(
            item =>
                item.id === id
        );

    if (!game) {

        throw new Error(
            "اللعبة غير موجودة: " +
            id
        );
    }

    return game;
}


/* =========================================================
   PARTITIONS
========================================================= */

function getGamePartition(game) {

    return (
        "persist:baqezu-game-" +
        game.id
    );
}


function getGameSession(game) {

    return session.fromPartition(
        getGamePartition(game)
    );
}


/* =========================================================
   LINKED GAMES
========================================================= */

function getLinkedGames() {

    const data =
        store.get(
            LINKED_GAMES_KEY,
            {}
        );

    if (
        !data ||
        typeof data !== "object"
    ) {
        return {};
    }

    return data;
}


/* =========================================================
   SAVE LINK
========================================================= */

function saveLinkedGame(
    game,
    result,
    fallbackUsername,
    password = ""
) {

    if (
        !result ||
        !result.token
    ) {

        throw new Error(
            "السيرفر لم يرجع Token."
        );
    }

    const linked =
        getLinkedGames();

    const oldData =
        linked[game.id] || {};

    const profile =
        result.profile ||
        oldData.profile ||
        {
            username:
                fallbackUsername
        };

    linked[game.id] = {

        ...oldData,

        gameId:
            game.id,

        token:
            result.token,

        profile,

        password:
            detectPasswordRequirement(game)
                ? safeString(
                    password ||
                    oldData.password
                )
                : "",

        hasPassword:
            detectPasswordRequirement(
                game
            ),

        game: {

            id:
                game.id,

            name:
                game.name,

            icon:
                game.icon,

            image:
                game.image,

            version:
                game.version,

            hasPassword:
                detectPasswordRequirement(
                    game
                )
        },

        linkedAt:
            oldData.linkedAt ||
            new Date().toISOString(),

        lastUpdated:
            new Date().toISOString()
    };

    store.set(
        LINKED_GAMES_KEY,
        linked
    );

    return linked[game.id];
}


/* =========================================================
   GAME LIST
========================================================= */

function buildGamesResponse(config) {

    const linked =
        getLinkedGames();

    return config.games.map(
        game => {

            const linkedData =
                linked[game.id];

            let safeData = null;

            if (linkedData) {

                safeData = {
                    ...linkedData
                };

                /*
                 * لا نرسل كلمة المرور
                 */
                delete safeData.password;
            }

            return {

                ...game,

                linked:
                    !!linkedData,

                data:
                    safeData
            };
        }
    );
}


/* =========================================================
   CREATE GAME WINDOW
========================================================= */

function createGameWindow(game) {

    const old =
        gameWindows.get(
            game.id
        );

    if (
        old &&
        !old.isDestroyed()
    ) {

        old.focus();

        return old;
    }

    const win =
        new BrowserWindow({

            width: 1280,
            height: 820,

            minWidth: 950,
            minHeight: 650,

            title:
                game.name +
                " - BAQEZU HUB",

            backgroundColor:
                "#090610",

            autoHideMenuBar:
                true,

            show:
                false,

            webPreferences: {

                contextIsolation:
                    true,

                nodeIntegration:
                    false,

                sandbox:
                    false,

                webSecurity:
                    false,

                partition:
                    getGamePartition(
                        game
                    )
            }
        });


    /* USER AGENT */

    win.webContents
        .setUserAgent(
            CHROME_USER_AGENT
        );


    /* PERMISSIONS */

    win.webContents.session
        .setPermissionRequestHandler(
            (
                webContents,
                permission,
                callback
            ) => {

                const allowed = [
                    "fullscreen",
                    "clipboard-read",
                    "clipboard-sanitized-write",
                    "notifications"
                ];

                callback(
                    allowed.includes(
                        permission
                    )
                );
            }
        );


    /* NAVIGATION */

    win.webContents.on(
        "will-navigate",
        (
            event,
            url
        ) => {

            console.log(
                `[${game.id}] NAVIGATE:`,
                url
            );

            /*
             * لا نمنع التنقل.
             *
             * اللعبة قد تنتقل إلى:
             *
             * /login
             * /room
             * /game
             * /play
             * /draw
             *
             * وغيرها.
             */
        }
    );


    win.webContents.on(
        "did-navigate",
        (
            event,
            url
        ) => {

            console.log(
                `[${game.id}] DID NAVIGATE:`,
                url
            );
        }
    );


    win.webContents.on(
        "did-navigate-in-page",
        (
            event,
            url
        ) => {

            console.log(
                `[${game.id}] IN PAGE:`,
                url
            );
        }
    );


    win.webContents.on(
        "did-finish-load",
        () => {

            console.log(
                `[${game.id}] PAGE READY:`,
                win.webContents.getURL()
            );
        }
    );


    win.webContents.on(
        "did-fail-load",
        (
            event,
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame
        ) => {

            if (!isMainFrame) {
                return;
            }

            if (errorCode === -3) {
                return;
            }

            console.warn(
                `[${game.id}] LOAD FAILED:`,
                errorCode,
                errorDescription,
                validatedURL
            );
        }
    );


    /* NEW WINDOWS */

    win.webContents.setWindowOpenHandler(
        ({ url }) => {

            console.log(
                `[${game.id}] NEW WINDOW:`,
                url
            );

            /*
             * السماح للألعاب باستخدام
             * window.open.
             */
            return {
                action: "allow"
            };
        }
    );


    /* CLOSED */

    win.on(
        "closed",
        () => {

            gameWindows.delete(
                game.id
            );
        }
    );


    gameWindows.set(
        game.id,
        win
    );

    return win;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(text) {

    return safeString(text)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   LOADING PAGE
========================================================= */

function createLoadingHtml(game) {

    return `
<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
/>

<title>BAQEZU HUB</title>

<style>

* {
    box-sizing: border-box;
}

html,
body {
    width: 100%;
    height: 100%;
    margin: 0;
}

body {

    display: flex;

    align-items: center;
    justify-content: center;

    background:
        radial-gradient(
            circle at center,
            #21112f,
            #090610 70%
        );

    color: white;

    font-family:
        Arial,
        sans-serif;
}

.box {

    text-align: center;

    padding: 40px;
}

.loader {

    width: 65px;
    height: 65px;

    margin:
        0 auto 25px;

    border:
        5px solid
        rgba(255,255,255,.12);

    border-top-color:
        #ff007f;

    border-radius:
        50%;

    animation:
        spin 1s linear infinite;
}

h2 {

    margin:
        0 0 10px;
}

p {

    color:
        #aaa;
}

@keyframes spin {

    to {
        transform:
            rotate(360deg);
    }
}

</style>

</head>

<body>

<div class="box">

    <div class="loader"></div>

    <h2>
        جاري فتح ${escapeHtml(game.name)}
    </h2>

    <p>
        يتم تشغيل اللعبة...
    </p>

</div>

</body>

</html>
`;
}


/* =========================================================
   LOAD GAME
========================================================= */

async function loadGameWindow(
    win,
    game
) {

    if (
        !win ||
        win.isDestroyed()
    ) {

        throw new Error(
            "نافذة اللعبة غير متاحة."
        );
    }

    console.log(
        `[${game.id}] OPEN:`,
        game.gameUrl
    );

    try {

        await win.loadURL(
            game.gameUrl,
            {
                userAgent:
                    CHROME_USER_AGENT
            }
        );

    } catch (error) {

        /*
         * ERR_ABORTED يحدث أحياناً
         * أثناء Redirect.
         */
        if (
            error.code !==
            "ERR_ABORTED"
        ) {

            console.warn(
                `[${game.id}] OPEN ERROR:`,
                error.code ||
                error.message
            );
        }
    }


    /*
     * ننتظر الصفحة قليلاً.
     */
    await wait(1000);


    if (
        isDestroyed(win)
    ) {

        throw new Error(
            "تم إغلاق نافذة اللعبة."
        );
    }


    const currentUrl =
        win.webContents.getURL();


    if (
        currentUrl &&
        currentUrl.startsWith("http")
    ) {

        console.log(
            `[${game.id}] GAME URL READY:`,
            currentUrl
        );

        return true;
    }


    /*
     * محاولة ثانية في حال لم يبدأ التحميل.
     */
    await wait(1200);


    try {

        await win.loadURL(
            game.gameUrl,
            {
                userAgent:
                    CHROME_USER_AGENT
            }
        );

    } catch (error) {

        if (
            error.code !==
            "ERR_ABORTED"
        ) {
            throw error;
        }
    }


    await wait(1000);


    const finalUrl =
        win.webContents.getURL();


    if (
        finalUrl &&
        finalUrl.startsWith("http")
    ) {

        return true;
    }


    throw new Error(
        "تعذر فتح اللعبة."
    );
}


/* =========================================================
   GET GAMES
========================================================= */

ipcMain.handle(
    "app:get-games",
    async () => {

        try {

            const config =
                await getGamesConfig();

            return {

                success:
                    true,

                games:
                    buildGamesResponse(
                        config
                    ),

                store:
                    config.store || {},

                source:
                    config.source,

                warning:
                    config.warning ||
                    null
            };

        } catch (error) {

            return {

                success:
                    false,

                games: [],

                error:
                    "games_load_error",

                message:
                    error.message ||
                    String(error)
            };
        }
    }
);


/* =========================================================
   REFRESH GAMES
========================================================= */

ipcMain.handle(
    "app:refresh-games",
    async () => {

        try {

            const config =
                await fetchRemoteGames();

            return {

                success:
                    true,

                games:
                    buildGamesResponse(
                        config
                    ),

                store:
                    config.store || {},

                source:
                    "remote"
            };

        } catch (error) {

            return {

                success:
                    false,

                error:
                    "refresh_error",

                message:
                    error.message ||
                    String(error)
            };
        }
    }
);


/* =========================================================
   GAME LINK
========================================================= */

ipcMain.handle(
    "game:link",
    async (
        event,
        gameId,
        username,
        password
    ) => {

        username =
            safeString(
                username
            ).trim();

        password =
            safeString(
                password
            );

        try {

            const game =
                await findGame(
                    gameId
                );


            /*
             * اللعبة لا تحتاج حساب.
             */

            if (
                !gameRequiresLogin(game)
            ) {

                return {

                    success:
                        true,

                    linked:
                        false,

                    message:
                        "هذه اللعبة لا تحتاج ربط حساب."
                };
            }


            if (!username) {

                return {

                    success:
                        false,

                    error:
                        "missing_username",

                    message:
                        "يرجى كتابة اسم اللاعب."
                };
            }


            /*
             * لا يوجد API.
             */

            if (!game.apiUrl) {

                return {

                    success:
                        false,

                    error:
                        "no_api",

                    message:
                        "هذه اللعبة تستخدم نظام تسجيل دخول داخلي."
                };
            }


            const needsPassword =
                detectPasswordRequirement(
                    game
                );


            if (
                needsPassword &&
                !password
            ) {

                return {

                    success:
                        false,

                    error:
                        "missing_password",

                    message:
                        game.passwordMessage ||
                        "يرجى كتابة كلمة المرور."
                };
            }


            /*
             * LOGIN DATA
             */

            const loginData = {

                action:
                    "login",

                username,

                device_name:
                    "BAQEZU HUB Desktop"
            };


            if (needsPassword) {

                loginData[
                    game.passwordField ||
                    "game_password"
                ] = password;
            }


            /*
             * API LOGIN
             */

            const result =
                await apiPost(
                    game,
                    loginData
                );


            if (
                !result.success
            ) {
                return result;
            }


            const saved =
                saveLinkedGame(
                    game,
                    result,
                    username,
                    password
                );


            return {

                success:
                    true,

                message:
                    result.message ||
                    "تم ربط الحساب بنجاح.",

                data:
                    saved
            };

        } catch (error) {

            return {

                success:
                    false,

                error:
                    "link_error",

                message:
                    error.message ||
                    String(error)
            };
        }
    }
);


/* =========================================================
   API POST
========================================================= */

async function apiPost(
    game,
    data
) {

    if (
        !game ||
        !game.apiUrl
    ) {

        throw new Error(
            "هذه اللعبة لا تحتوي API."
        );
    }


    const apiSession =
        getGameSession(game);


    try {

        apiSession.setUserAgent(
            CHROME_USER_AGENT
        );

    } catch {
        // ignore
    }


    let apiWindow =
        apiWindows.get(
            game.id
        );


    if (
        !apiWindow ||
        apiWindow.isDestroyed()
    ) {

        apiWindow =
            new BrowserWindow({

                show:
                    false,

                webPreferences: {

                    contextIsolation:
                        true,

                    nodeIntegration:
                        false,

                    sandbox:
                        false,

                    webSecurity:
                        false,

                    partition:
                        getGamePartition(
                            game
                        )
                }
            });


        apiWindow.webContents
            .setUserAgent(
                CHROME_USER_AGENT
            );


        apiWindows.set(
            game.id,
            apiWindow
        );


        apiWindow.on(
            "closed",
            () => {

                apiWindows.delete(
                    game.id
                );
            }
        );
    }


    /*
     * تأكد من تحميل origin الـ API
     * قبل fetch.
     *
     * هذا يساعد في الحالات التي يكون
     * فيها API يعتمد على cookies/session.
     */

    try {

        const currentUrl =
            apiWindow.webContents.getURL();

        const targetOrigin =
            new URL(
                game.apiUrl
            ).origin;

        if (
            !currentUrl ||
            !sameOrigin(
                currentUrl,
                game.apiUrl
            )
        ) {

            await apiWindow.loadURL(
                targetOrigin,
                {
                    userAgent:
                        CHROME_USER_AGENT
                }
            );
        }

    } catch (error) {

        console.warn(
            `[${game.id}] API ORIGIN LOAD WARNING:`,
            error.message
        );
    }


    const apiUrlJson =
        JSON.stringify(
            game.apiUrl
        );

    const dataJson =
        JSON.stringify(
            data
        );


    const script = `
        (async () => {

            try {

                const requestData =
                    ${dataJson};

                const body =
                    new URLSearchParams();

                Object.keys(
                    requestData
                ).forEach(
                    key => {

                        let value =
                            requestData[key];

                        if (
                            value === null ||
                            value === undefined
                        ) {
                            value = "";
                        }

                        body.append(
                            key,
                            String(value)
                        );
                    }
                );


                const response =
                    await fetch(
                        ${apiUrlJson},
                        {

                            method:
                                "POST",

                            credentials:
                                "include",

                            cache:
                                "no-store",

                            redirect:
                                "follow",

                            headers: {

                                "Content-Type":
                                    "application/x-www-form-urlencoded; charset=UTF-8",

                                "Accept":
                                    "application/json, text/plain, */*"
                            },

                            body:
                                body.toString()
                        }
                    );


                return {

                    success:
                        true,

                    status:
                        response.status,

                    finalUrl:
                        response.url,

                    text:
                        await response.text()
                };


            } catch (error) {

                return {

                    success:
                        false,

                    error:
                        error &&
                        error.message
                            ? error.message
                            : String(error)
                };
            }

        })();
    `;


    const result =
        await apiWindow
            .webContents
            .executeJavaScript(
                script,
                true
            );


    if (
        !result ||
        !result.success
    ) {

        throw new Error(
            result &&
            result.error
                ? result.error
                : "فشل الاتصال بـ API."
        );
    }


    try {

        const json =
            parseJsonResponse(
                result.text,
                game.id + " API"
            );

        json.httpStatus =
            result.status;

        json.finalUrl =
            result.finalUrl || "";

        return json;

    } catch {

        return {

            success:
                false,

            error:
                "invalid_server_response",

            message:
                "السيرفر أعاد استجابة غير صالحة.",

            httpStatus:
                result.status,

            finalUrl:
                result.finalUrl || "",

            debug:
                safeString(
                    result.text
                ).substring(
                    0,
                    3000
                )
        };
    }
}


/* =========================================================
   GAME REFRESH
========================================================= */

ipcMain.handle(
    "game:refresh",
    async (
        event,
        gameId
    ) => {

        try {

            const game =
                await findGame(
                    gameId
                );

            const linked =
                getLinkedGames();

            const gameData =
                linked[game.id];


            if (
                !gameData ||
                !gameData.token
            ) {

                return {

                    success:
                        false,

                    error:
                        "not_linked",

                    message:
                        "الحساب غير مربوط."
                };
            }


            if (!game.apiUrl) {

                return {

                    success:
                        false,

                    error:
                        "no_api",

                    message:
                        "هذه اللعبة لا تحتوي API خارجي."
                };
            }


            const result =
                await apiPost(
                    game,
                    {

                        action:
                            "profile",

                        token:
                            gameData.token
                    }
                );


            if (!result.success) {
                return result;
            }


            linked[game.id] = {

                ...gameData,

                profile:
                    result.profile ||
                    gameData.profile,

                lastUpdated:
                    new Date()
                        .toISOString()
            };


            store.set(
                LINKED_GAMES_KEY,
                linked
            );


            return {

                success:
                    true,

                data:
                    linked[game.id]
            };

        } catch (error) {

            return {

                success:
                    false,

                error:
                    "refresh_error",

                message:
                    error.message ||
                    String(error)
            };
        }
    }
);


/* =========================================================
   UNLINK
========================================================= */

ipcMain.handle(
    "game:unlink",
    async (
        event,
        gameId
    ) => {

        try {

            const game =
                await findGame(
                    gameId
                );

            const linked =
                getLinkedGames();


            delete linked[game.id];


            store.set(
                LINKED_GAMES_KEY,
                linked
            );


            return {

                success:
                    true,

                message:
                    "تم فصل الحساب."
            };

        } catch (error) {

            return {

                success:
                    false,

                error:
                    "unlink_error",

                message:
                    error.message ||
                    String(error)
            };
        }
    }
);


/* =========================================================
   OPEN GAME
========================================================= */

ipcMain.handle(
    "game:open",
    async (
        event,
        gameId
    ) => {

        let gameWindow = null;

        try {

            const game =
                await findGame(
                    gameId
                );


            console.log(
                "================================"
            );

            console.log(
                "OPEN GAME:",
                game.id
            );

            console.log(
                "URL:",
                game.gameUrl
            );

            console.log(
                "API:",
                game.apiUrl || "NONE"
            );

            console.log(
                "ACCOUNT:",
                getAccountSystem(game)
            );

            console.log(
                "LOGIN:",
                gameRequiresLogin(game)
            );

            console.log(
                "PASSWORD:",
                detectPasswordRequirement(game)
            );

            console.log(
                "================================"
            );


            /* =================================================
               LOGIN ONLY WHEN REQUIRED
            ================================================= */

            if (
                gameRequiresLogin(game)
            ) {

                const linked =
                    getLinkedGames();

                const gameData =
                    linked[game.id];


                if (
                    !gameData ||
                    !gameData.token
                ) {

                    return {

                        success:
                            false,

                        error:
                            "not_linked",

                        message:
                            "يجب ربط حساب اللعبة أولاً."
                    };
                }


                /*
                 * إذا اللعبة لديها API
                 * نحاول تحديث الـ Token.
                 *
                 * ولكن فشل API لا يمنع
                 * فتح اللعبة.
                 */

                if (game.apiUrl) {

                    const username =
                        safeString(
                            gameData.profile &&
                            gameData.profile.username
                        ).trim();


                    if (!username) {

                        return {

                            success:
                                false,

                            error:
                                "missing_username",

                            message:
                                "اسم المستخدم غير موجود."
                        };
                    }


                    const loginData = {

                        action:
                            "login",

                        username,

                        device_name:
                            "BAQEZU HUB Game Window"
                    };


                    if (
                        detectPasswordRequirement(
                            game
                        )
                    ) {

                        const password =
                            safeString(
                                gameData.password
                            );


                        if (!password) {

                            return {

                                success:
                                    false,

                                error:
                                    "missing_password",

                                message:
                                    game.passwordMessage ||
                                    "يرجى إدخال كلمة المرور."
                            };
                        }


                        loginData[
                            game.passwordField ||
                            "game_password"
                        ] = password;
                    }


                    try {

                        const loginResult =
                            await apiPost(
                                game,
                                loginData
                            );


                        if (
                            loginResult &&
                            loginResult.success &&
                            loginResult.token
                        ) {

                            saveLinkedGame(
                                game,
                                loginResult,
                                username,
                                detectPasswordRequirement(game)
                                    ? safeString(
                                        gameData.password
                                    )
                                    : ""
                            );
                        }

                    } catch (error) {

                        console.warn(
                            `[${game.id}] API LOGIN WARNING:`,
                            error.message
                        );
                    }
                }
            }


            /* =================================================
               EXISTING WINDOW
            ================================================= */

            const existing =
                gameWindows.get(
                    game.id
                );


            if (
                existing &&
                !existing.isDestroyed()
            ) {

                if (
                    existing.isMinimized()
                ) {
                    existing.restore();
                }

                existing.show();
                existing.focus();


                return {

                    success:
                        true,

                    gameId:
                        game.id
                };
            }


            /* =================================================
               CREATE WINDOW
            ================================================= */

            gameWindow =
                createGameWindow(
                    game
                );


            /* =================================================
               LOADING SCREEN
            ================================================= */

            try {

                await gameWindow.loadURL(
                    "data:text/html;charset=utf-8," +
                    encodeURIComponent(
                        createLoadingHtml(
                            game
                        )
                    )
                );

            } catch {
                // ignore
            }


            await wait(300);


            /* =================================================
               OPEN DIRECTLY
            ================================================= */

            await loadGameWindow(
                gameWindow,
                game
            );


            /* =================================================
               SHOW
            ================================================= */

            if (
                gameWindow &&
                !gameWindow.isDestroyed()
            ) {

                gameWindow.show();
                gameWindow.focus();
            }


            console.log(
                `[${game.id}] OPENED SUCCESSFULLY`
            );


            return {

                success:
                    true,

                gameId:
                    game.id,

                url:
                    game.gameUrl
            };


        } catch (error) {

            console.error(
                "OPEN GAME ERROR:",
                error
            );


            if (
                gameWindow &&
                !gameWindow.isDestroyed()
            ) {

                try {
                    gameWindow.close();
                } catch {
                    // ignore
                }
            }


            return {

                success:
                    false,

                error:
                    "open_game_error",

                message:
                    error.message ||
                    String(error)
            };
        }
    }
);


/* =========================================================
   CLEAR DATA
========================================================= */

ipcMain.handle(
    "app:clear-data",
    async () => {

        try {

            store.clear();


            for (
                const win
                of gameWindows.values()
            ) {

                if (
                    win &&
                    !win.isDestroyed()
                ) {

                    try {
                        win.close();
                    } catch {
                        // ignore
                    }
                }
            }


            for (
                const win
                of apiWindows.values()
            ) {

                if (
                    win &&
                    !win.isDestroyed()
                ) {

                    try {
                        win.close();
                    } catch {
                        // ignore
                    }
                }
            }


            gameWindows.clear();
            apiWindows.clear();


            return {

                success:
                    true,

                message:
                    "تم حذف جميع بيانات BAQEZU HUB."
            };


        } catch (error) {

            return {

                success:
                    false,

                message:
                    error.message ||
                    String(error)
            };
        }
    }
);


/* =========================================================
   BEFORE QUIT
========================================================= */

app.on(
    "before-quit",
    () => {

        for (
            const win
            of gameWindows.values()
        ) {

            if (
                win &&
                !win.isDestroyed()
            ) {

                try {
                    win.destroy();
                } catch {
                    // ignore
                }
            }
        }


        for (
            const win
            of apiWindows.values()
        ) {

            if (
                win &&
                !win.isDestroyed()
            ) {

                try {
                    win.destroy();
                } catch {
                    // ignore
                }
            }
        }


        gameWindows.clear();
        apiWindows.clear();
    }
);