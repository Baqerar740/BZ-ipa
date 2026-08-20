"use strict";

/*
|--------------------------------------------------------------------------
| BAQEZU HUB - UNIVERSAL RENDERER
|--------------------------------------------------------------------------
| VERSION 6.0
|--------------------------------------------------------------------------
| إصلاحات النسخة:
|
| 1. إصلاح عدم ظهور حقل كلمة المرور.
| 2. إصلاح اختلاف ID بين HTML و JavaScript.
| 3. دعم passwordField الموجود فعلياً في index.html.
| 4. دعم passwordFieldLabel بدون الحاجة لوجوده.
| 5. دعم زر إظهار/إخفاء كلمة المرور.
| 6. إزالة hidden / display:none بشكل صحيح عند الحاجة.
| 7. دعم إعدادات كلمة المرور داخل:
|    - game
|    - game.data
|    - game.auth
|    - game.login
| 8. دعم passwordRequired / requiresPassword وغيرها.
| 9. دعم password كـ boolean أو object.
| 10. الحفاظ على بقية وظائف BAQEZU HUB.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

const state = {

    games: {},

    loading: false,

    actionLoading: false,

    currentPage: "home",

    currentGameId: null,

    modalGameId: null,

    toastTimer: null,

    initialized: false,

    lastLoadTime: 0

};


/*
|--------------------------------------------------------------------------
| PAGE DATA
|--------------------------------------------------------------------------
*/

const pages = {

    home: {
        title: "الرئيسية",
        subtitle: "مركز ألعابك وحساباتك في مكان واحد"
    },

    games: {
        title: "ألعابي",
        subtitle: "جميع الألعاب المتوفرة في BAQEZU HUB"
    },

    profile: {
        title: "الحسابات",
        subtitle: "إدارة الحسابات المرتبطة بجميع ألعابك"
    },

    settings: {
        title: "الإعدادات",
        subtitle: "إدارة بيانات التطبيق"
    }

};


/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        if (state.initialized) {
            return;
        }

        state.initialized = true;

        setupApp();

        showPage("home");

        await loadGames();

    }
);


/*
|--------------------------------------------------------------------------
| SETUP
|--------------------------------------------------------------------------
*/

function setupApp() {

    setupNavigation();

    setupHeroButton();

    setupRefreshButton();

    setupClearDataButton();

    setupModal();

    setupConnectionStatus();

    setupGlobalGameEvents();

}


/*
|--------------------------------------------------------------------------
| NAVIGATION
|--------------------------------------------------------------------------
*/

function setupNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        cleanString(
                            button.dataset.page,
                            100
                        );

                    showPage(page);

                }
            );

        });

}


/*
|--------------------------------------------------------------------------
| HERO
|--------------------------------------------------------------------------
*/

function setupHeroButton() {

    const button =
        document.querySelector(
            "#heroGamesBtn, .hero .primary-btn"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => showPage("games")
    );

}


/*
|--------------------------------------------------------------------------
| REFRESH
|--------------------------------------------------------------------------
*/

function setupRefreshButton() {

    const button =
        document.getElementById(
            "refreshAllBtn"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            if (
                state.loading ||
                state.actionLoading
            ) {
                return;
            }

            button.disabled = true;

            button.classList.add(
                "spinning"
            );

            try {

                await loadGames(
                    true,
                    true
                );

            } finally {

                button.disabled = false;

                button.classList.remove(
                    "spinning"
                );

            }

        }
    );

}


/*
|--------------------------------------------------------------------------
| CLEAR DATA
|--------------------------------------------------------------------------
*/

function setupClearDataButton() {

    const button =
        document.getElementById(
            "clearDataBtn"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        clearAllData
    );

}


/*
|--------------------------------------------------------------------------
| MODAL SETUP
|--------------------------------------------------------------------------
*/

function setupModal() {

    const modal =
        document.getElementById(
            "linkModal"
        );

    if (!modal) {
        return;
    }

    const close =
        document.getElementById(
            "closeModalBtn"
        );

    const backdrop =
        modal.querySelector(
            ".modal-backdrop"
        );

    const form =
        document.getElementById(
            "linkForm"
        );

    close?.addEventListener(
        "click",
        closeLinkModal
    );

    backdrop?.addEventListener(
        "click",
        closeLinkModal
    );

    form?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            await submitGameAccount();

        }
    );


    /*
    |--------------------------------------------------------------------------
    | PASSWORD TOGGLE
    |--------------------------------------------------------------------------
    */

    setupPasswordToggle();


    /*
    |--------------------------------------------------------------------------
    | ESC
    |--------------------------------------------------------------------------
    */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                !modal.classList.contains("hidden")
            ) {

                closeLinkModal();

            }

        }
    );

}


/*
|--------------------------------------------------------------------------
| PASSWORD TOGGLE
|--------------------------------------------------------------------------
*/

function setupPasswordToggle() {

    const button =
        document.getElementById(
            "togglePasswordBtn"
        );

    const input =
        document.getElementById(
            "passwordInput"
        );

    if (!button || !input) {
        return;
    }

    /*
    |--------------------------------------------------------------------------
    | منع تسجيل الحدث أكثر من مرة
    |--------------------------------------------------------------------------
    */

    if (
        button.dataset.passwordToggleReady === "true"
    ) {
        return;
    }

    button.dataset.passwordToggleReady = "true";

    button.addEventListener(
        "click",
        () => {

            if (
                input.type === "password"
            ) {

                input.type = "text";

                button.textContent = "🙈";

                button.setAttribute(
                    "aria-label",
                    "إخفاء كلمة المرور"
                );

                button.setAttribute(
                    "title",
                    "إخفاء كلمة المرور"
                );

            } else {

                input.type = "password";

                button.textContent = "👁️";

                button.setAttribute(
                    "aria-label",
                    "إظهار كلمة المرور"
                );

                button.setAttribute(
                    "title",
                    "إظهار كلمة المرور"
                );

            }

        }
    );

}


/*
|--------------------------------------------------------------------------
| GLOBAL EVENTS
|--------------------------------------------------------------------------
*/

function setupGlobalGameEvents() {

    window.addEventListener(
        "baqezu-games-updated",
        async () => {

            await loadGames(
                false,
                true
            );

        }
    );

}


/*
|--------------------------------------------------------------------------
| CONNECTION
|--------------------------------------------------------------------------
*/

function setupConnectionStatus() {

    updateConnectionStatus();

    window.addEventListener(
        "online",
        updateConnectionStatus
    );

    window.addEventListener(
        "offline",
        updateConnectionStatus
    );

}


/*
|--------------------------------------------------------------------------
| SHOW PAGE
|--------------------------------------------------------------------------
*/

function showPage(pageName) {

    if (!pages[pageName]) {
        pageName = "home";
    }

    state.currentPage =
        pageName;

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.toggle(
                "active",
                page.id ===
                `page-${pageName}`
            );

        });

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page ===
                pageName
            );

        });

    const title =
        document.getElementById(
            "pageTitle"
        );

    const subtitle =
        document.getElementById(
            "pageSubtitle"
        );

    if (title) {

        title.textContent =
            pages[pageName].title;

    }

    if (subtitle) {

        subtitle.textContent =
            pages[pageName].subtitle;

    }

}


/*
|--------------------------------------------------------------------------
| LOAD GAMES
|--------------------------------------------------------------------------
*/

async function loadGames(
    showMessage = false,
    force = false
) {

    if (state.loading) {
        return false;
    }

    if (
        !force &&
        Date.now() -
        state.lastLoadTime <
        1000
    ) {

        return true;

    }

    state.loading = true;

    try {

        if (
            !window.baqezu ||
            typeof window.baqezu.getGames !==
            "function"
        ) {

            throw new Error(
                "خدمة الألعاب غير متوفرة. تأكد من preload.js."
            );

        }

        const result =
            await window.baqezu.getGames();

        const games =
            normalizeGamesResult(
                result
            );

        if (
            Object.keys(games).length === 0 &&
            state.lastLoadTime > 0
        ) {

            console.warn(
                "[BAQEZU] Empty games response ignored."
            );

        } else {

            state.games =
                games;

        }

        state.lastLoadTime =
            Date.now();

        renderAll();

        if (showMessage) {

            showToast(
                `تم تحديث ${getGameList().length} لعبة بنجاح.`,
                "success"
            );

        }

        return true;

    } catch (error) {

        console.error(
            "[BAQEZU] LOAD GAMES ERROR:",
            error
        );

        const message =
            getErrorMessage(
                error,
                "حدث خطأ أثناء تحميل الألعاب."
            );

        if (
            getGameList().length === 0
        ) {

            renderErrorState(
                message
            );

        }

        showToast(
            message,
            "error"
        );

        return false;

    } finally {

        state.loading = false;

    }

}


/*
|--------------------------------------------------------------------------
| NORMALIZE RESULT
|--------------------------------------------------------------------------
*/

function normalizeGamesResult(result) {

    if (!result) {
        return {};
    }

    if (Array.isArray(result)) {

        return arrayToGamesObject(
            result
        );

    }

    if (
        typeof result !== "object"
    ) {

        return {};

    }

    if (
        result.success === false
    ) {

        throw new Error(
            result.message ||
            result.error ||
            "تعذر تحميل قائمة الألعاب."
        );

    }

    if (
        Array.isArray(
            result.games
        )
    ) {

        return arrayToGamesObject(
            result.games
        );

    }

    if (
        result.games &&
        typeof result.games ===
        "object"
    ) {

        return normalizeGameObject(
            result.games
        );

    }

    if (
        Array.isArray(
            result.data
        )
    ) {

        return arrayToGamesObject(
            result.data
        );

    }

    if (
        result.data &&
        typeof result.data ===
        "object"
    ) {

        if (
            Array.isArray(
                result.data.games
            )
        ) {

            return arrayToGamesObject(
                result.data.games
            );

        }

        return normalizeGameObject(
            result.data
        );

    }

    if (
        Array.isArray(
            result.gamesList
        )
    ) {

        return arrayToGamesObject(
            result.gamesList
        );

    }

    return normalizeGameObject(
        result
    );

}


/*
|--------------------------------------------------------------------------
| NORMALIZE OBJECT
|--------------------------------------------------------------------------
*/

function normalizeGameObject(object) {

    const output = {};

    if (
        !object ||
        typeof object !== "object"
    ) {

        return output;

    }

    Object.entries(object)
        .forEach(
            ([key, value], index) => {

                if (
                    !value ||
                    typeof value !==
                    "object" ||
                    Array.isArray(value)
                ) {

                    return;

                }

                const game =
                    normalizeGame(
                        value,
                        key,
                        index
                    );

                if (!game) {
                    return;
                }

                output[game.id] =
                    game;

            }
        );

    return output;

}


/*
|--------------------------------------------------------------------------
| ARRAY TO OBJECT
|--------------------------------------------------------------------------
*/

function arrayToGamesObject(games) {

    const output = {};

    if (!Array.isArray(games)) {
        return output;
    }

    games.forEach(
        (game, index) => {

            const normalized =
                normalizeGame(
                    game,
                    "",
                    index
                );

            if (!normalized) {
                return;
            }

            output[normalized.id] =
                normalized;

        }
    );

    return output;

}


/*
|--------------------------------------------------------------------------
| NORMALIZE GAME
|--------------------------------------------------------------------------
*/

function normalizeGame(
    game,
    fallbackId = "",
    index = 0
) {

    if (
        !game ||
        typeof game !== "object"
    ) {

        return null;

    }

    const id =
        cleanString(
            game.id ||
            game.gameId ||
            game.game_id ||
            game.slug ||
            game.key ||
            fallbackId ||
            `game_${index}`,
            150
        );

    if (!id) {
        return null;
    }

    return {

        ...game,

        id,

        name:
            cleanString(
                game.name ||
                game.title ||
                game.displayName ||
                game.label ||
                id,
                200
            ),

        description:
            cleanString(
                game.description ||
                game.desc ||
                "",
                500
            ),

        image:
            cleanString(
                game.image ||
                game.imageUrl ||
                game.image_url ||
                game.cover ||
                game.coverUrl ||
                game.data?.image ||
                "",
                2000
            ),

        icon:
            cleanString(
                game.icon ||
                game.emoji ||
                "🎮",
                200
            )

    };

}


/*
|--------------------------------------------------------------------------
| GAME LIST
|--------------------------------------------------------------------------
*/

function getGameList() {

    return Object
        .values(
            state.games || {}
        )
        .filter(
            game =>
                game &&
                typeof game === "object"
        )
        .sort(
            (a, b) => {

                const sortA =
                    numberValue(
                        a.sort ??
                        a.order ??
                        999999
                    );

                const sortB =
                    numberValue(
                        b.sort ??
                        b.order ??
                        999999
                    );

                if (
                    sortA !== sortB
                ) {

                    return sortA -
                        sortB;

                }

                return getGameName(a)
                    .localeCompare(
                        getGameName(b),
                        "ar"
                    );

            }
        );

}


/*
|--------------------------------------------------------------------------
| GET GAME
|--------------------------------------------------------------------------
*/

function getGameById(gameId) {

    const id =
        cleanString(
            gameId,
            150
        );

    if (!id) {
        return null;
    }

    return (
        state.games?.[id] ||
        getGameList().find(
            game =>
                getGameId(game) ===
                id
        ) ||
        null
    );

}


/*
|--------------------------------------------------------------------------
| RENDER ALL
|--------------------------------------------------------------------------
*/

function renderAll() {

    const games =
        getGameList();

    renderHomeGames(
        games
    );

    renderGamesLibrary(
        games
    );

    renderAccounts(
        games
    );

    renderStatistics(
        games
    );

}


/*
|--------------------------------------------------------------------------
| HOME
|--------------------------------------------------------------------------
*/

function renderHomeGames(games) {

    const container =
        document.getElementById(
            "homeGamesList"
        );

    if (!container) {
        return;
    }

    const linked =
        games.filter(
            isGameLinked
        );

    if (!linked.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🎮
                </div>

                <h3>
                    لا توجد ألعاب مرتبطة
                </h3>

                <p>
                    اذهب إلى قسم ألعابي لرؤية جميع الألعاب.
                </p>

                <button
                    type="button"
                    class="primary-btn"
                    id="goToGamesBtn"
                >
                    استعراض الألعاب
                </button>

            </div>

        `;

        document
            .getElementById(
                "goToGamesBtn"
            )
            ?.addEventListener(
                "click",
                () =>
                    showPage("games")
            );

        return;

    }

    container.innerHTML =
        linked
            .map(renderGameCard)
            .join("");

    bindGameButtons(
        container
    );

}


/*
|--------------------------------------------------------------------------
| GAMES LIBRARY
|--------------------------------------------------------------------------
*/

function renderGamesLibrary(games) {

    const container =
        document.getElementById(
            "gamesLibrary"
        );

    if (!container) {
        return;
    }

    if (!games.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🎮
                </div>

                <h3>
                    لا توجد ألعاب
                </h3>

                <p>
                    لم يتم العثور على ألعاب في السيرفر.
                </p>

                <button
                    type="button"
                    class="primary-btn"
                    id="retryGamesBtn"
                >
                    إعادة تحميل الألعاب
                </button>

            </div>

        `;

        document
            .getElementById(
                "retryGamesBtn"
            )
            ?.addEventListener(
                "click",
                () =>
                    loadGames(
                        false,
                        true
                    )
            );

        return;

    }

    container.innerHTML =
        games
            .map(renderGameCard)
            .join("");

    bindGameButtons(
        container
    );

}


/*
|--------------------------------------------------------------------------
| GAME CARD
|--------------------------------------------------------------------------
*/

function renderGameCard(game) {

    const id =
        getGameId(game);

    const name =
        getGameName(game);

    const description =
        getGameDescription(game);

    const linked =
        isGameLinked(game);

    const profile =
        getGameProfile(game);

    const username =
        getUsername(profile);

    const playerId =
        getPlayerId(profile);

    const image =
        getGameImage(game);

    const icon =
        getGameIcon(game);

    const stats =
        linked &&
        (
            profile.stats ||
            profile.games_played !==
            undefined ||
            profile.wins !==
            undefined ||
            profile.score !==
            undefined
        );

    const requiresPassword =
        gameRequiresPassword(
            game
        );

    return `

        <div
            class="game-card"
            data-game-id="${escapeHtml(id)}"
        >

            <div class="game-card-top">

                <div class="game-logo">

                    ${renderGameVisual(
                        image,
                        icon,
                        name
                    )}

                </div>

                <div class="status-badge ${
                    linked
                        ? "linked"
                        : "unlinked"
                }">

                    ${
                        linked
                            ? "● مربوط"
                            : "● غير مربوط"
                    }

                </div>

            </div>

            <h3>
                ${escapeHtml(name)}
            </h3>

            ${
                description
                    ? `
                        <div class="game-description">
                            ${escapeHtml(
                                description
                            )}
                        </div>
                    `
                    : ""
            }

            <div class="game-player">

                ${
                    linked
                        ? `
                            👤
                            ${escapeHtml(
                                username
                            )}
                        `
                        : `
                            لم يتم ربط الحساب
                        `
                }

            </div>

            ${
                linked && playerId
                    ? `
                        <div class="game-player">
                            ID:
                            ${escapeHtml(
                                playerId
                            )}
                        </div>
                    `
                    : ""
            }

            ${
                stats
                    ? renderGameStats(
                        profile
                    )
                    : !linked
                        ? `
                            <div class="unlinked-info">
                                اربط حسابك للبدء باللعب.
                            </div>
                        `
                        : ""
            }

            ${
                requiresPassword
                    ? `
                        <div class="password-required-info">
                            🔐 هذه اللعبة تحتاج كلمة مرور
                        </div>
                    `
                    : ""
            }

            <div class="game-actions">

                ${
                    linked
                        ? `
                            <button
                                type="button"
                                class="primary-btn"
                                data-action="play"
                                data-game="${escapeHtml(id)}"
                            >
                                ${escapeHtml(
                                    getPlayLabel(game)
                                )}
                            </button>
                        `
                        : `
                            <button
                                type="button"
                                class="primary-btn"
                                data-action="link"
                                data-game="${escapeHtml(id)}"
                            >
                                ${escapeHtml(
                                    getLinkLabel(game)
                                )}
                            </button>
                        `
                }

            </div>

            ${
                linked
                    ? `
                        <div class="game-actions extra-actions">

                            <button
                                type="button"
                                class="secondary-btn"
                                data-action="refresh"
                                data-game="${escapeHtml(id)}"
                            >
                                ↻ تحديث
                            </button>

                            <button
                                type="button"
                                class="danger-btn"
                                data-action="unlink"
                                data-game="${escapeHtml(id)}"
                            >
                                فصل الحساب
                            </button>

                        </div>
                    `
                    : ""
            }

        </div>

    `;

}


/*
|--------------------------------------------------------------------------
| IMAGE
|--------------------------------------------------------------------------
*/

function getGameImage(game) {

    return cleanString(
        game?.image ||
        game?.imageUrl ||
        game?.image_url ||
        game?.cover ||
        game?.coverUrl ||
        game?.data?.image ||
        "",
        2000
    );

}


/*
|--------------------------------------------------------------------------
| VISUAL
|--------------------------------------------------------------------------
*/

function renderGameVisual(
    image,
    icon,
    name
) {

    if (
        isValidImageUrl(image)
    ) {

        return `

            <img
                class="game-image"
                src="${escapeHtml(image)}"
                alt="${escapeHtml(name)}"
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror="
                    this.style.display='none';
                    if(this.nextElementSibling){
                        this.nextElementSibling.style.display='flex';
                    }
                "
            >

            <span
                class="game-image-fallback"
                style="display:none"
            >
                ${escapeHtml(icon)}
            </span>

        `;

    }

    return renderGameIcon(
        icon
    );

}


/*
|--------------------------------------------------------------------------
| VALID IMAGE
|--------------------------------------------------------------------------
*/

function isValidImageUrl(value) {

    const url =
        cleanString(
            value,
            2000
        );

    if (!url) {
        return false;
    }

    return (
        /^https?:\/\//i.test(url) ||
        /^file:\/\//i.test(url) ||
        /^data:image\//i.test(url) ||
        /\.(png|jpe?g|webp|gif|svg|ico)(\?.*)?$/i.test(url)
    );

}


/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

function getGameProfile(game) {

    if (
        game?.profile &&
        typeof game.profile ===
        "object"
    ) {

        return game.profile;

    }

    if (
        game?.data?.profile &&
        typeof game.data.profile ===
        "object"
    ) {

        return game.data.profile;

    }

    return {};

}


/*
|--------------------------------------------------------------------------
| ID
|--------------------------------------------------------------------------
*/

function getGameId(game) {

    return cleanString(
        game?.id ||
        game?.gameId ||
        game?.game_id ||
        game?.slug ||
        "game",
        150
    );

}


/*
|--------------------------------------------------------------------------
| NAME
|--------------------------------------------------------------------------
*/

function getGameName(game) {

    return cleanString(
        game?.name ||
        game?.title ||
        game?.displayName ||
        game?.label ||
        game?.id ||
        "لعبة",
        200
    );

}


/*
|--------------------------------------------------------------------------
| ICON
|--------------------------------------------------------------------------
*/

function getGameIcon(game) {

    return cleanString(
        game?.icon ||
        game?.emoji ||
        "🎮",
        200
    );

}


/*
|--------------------------------------------------------------------------
| DESCRIPTION
|--------------------------------------------------------------------------
*/

function getGameDescription(game) {

    return cleanString(
        game?.description ||
        game?.desc ||
        "",
        500
    );

}


/*
|--------------------------------------------------------------------------
| USERNAME
|--------------------------------------------------------------------------
*/

function getUsername(profile) {

    return cleanString(
        profile?.username ||
        profile?.name ||
        profile?.nickname ||
        profile?.player_name ||
        "لاعب",
        150
    );

}


/*
|--------------------------------------------------------------------------
| PLAYER ID
|--------------------------------------------------------------------------
*/

function getPlayerId(profile) {

    return cleanString(
        profile?.player_id ||
        profile?.playerId ||
        profile?.id ||
        "",
        150
    );

}


/*
|--------------------------------------------------------------------------
| LINK LABEL
|--------------------------------------------------------------------------
*/

function getLinkLabel(game) {

    return cleanString(
        game?.linkLabel ||
        game?.link_text ||
        "🔗 ربط الحساب",
        100
    );

}


/*
|--------------------------------------------------------------------------
| PLAY LABEL
|--------------------------------------------------------------------------
*/

function getPlayLabel(game) {

    return cleanString(
        game?.playLabel ||
        game?.play_text ||
        "🎮 ابدأ اللعب",
        100
    );

}


/*
|--------------------------------------------------------------------------
| ICON
|--------------------------------------------------------------------------
*/

function renderGameIcon(icon) {

    const value =
        cleanString(
            icon,
            200
        );

    if (
        isValidImageUrl(value)
    ) {

        return `

            <img
                class="game-image"
                src="${escapeHtml(value)}"
                alt=""
                loading="lazy"
            >

        `;

    }

    return `

        <span class="game-icon-text">
            ${escapeHtml(
                value || "🎮"
            )}
        </span>

    `;

}


/*
|--------------------------------------------------------------------------
| LINKED
|--------------------------------------------------------------------------
*/

function isGameLinked(game) {

    if (!game) {
        return false;
    }

    return (
        game.linked === true ||
        game.isLinked === true ||
        game.connected === true ||
        game.accountLinked === true ||
        game.account_linked === true
    );

}


/*
|--------------------------------------------------------------------------
| PASSWORD DETECTION
|--------------------------------------------------------------------------
| هذه أهم دالة في الإصلاح.
|--------------------------------------------------------------------------
*/

function gameRequiresPassword(game) {

    if (
        !game ||
        typeof game !== "object"
    ) {

        return false;

    }


    /*
    |--------------------------------------------------------------------------
    | كل الأماكن المحتملة لإعدادات المصادقة
    |--------------------------------------------------------------------------
    */

    const sources = [

        game,

        game.data,

        game.auth,

        game.login,

        game.authentication,

        game.credentials,

        game.settings,

        game.config,

        game.data?.auth,

        game.data?.login,

        game.data?.authentication,

        game.data?.credentials,

        game.data?.settings,

        game.data?.config

    ].filter(
        value =>
            value &&
            typeof value === "object"
    );


    /*
    |--------------------------------------------------------------------------
    | أسماء الخصائص التي تعني أن كلمة المرور مطلوبة
    |--------------------------------------------------------------------------
    */

    const keys = [

        "passwordRequired",

        "password_required",

        "requiresPassword",

        "requires_password",

        "needPassword",

        "need_password",

        "needsPassword",

        "needs_password",

        "hasPassword",

        "has_password",

        "passwordEnabled",

        "password_enabled",

        "requirePassword",

        "require_password",

        "usePassword",

        "use_password",

        "loginWithPassword",

        "login_with_password",

        "enablePassword",

        "enable_password"

    ];


    /*
    |--------------------------------------------------------------------------
    | فحص الخصائص
    |--------------------------------------------------------------------------
    */

    for (
        const source of sources
    ) {

        for (
            const key of keys
        ) {

            if (
                !Object.prototype.hasOwnProperty.call(
                    source,
                    key
                )
            ) {

                continue;

            }

            const value =
                source[key];

            if (
                value === true
            ) {

                return true;

            }

            if (
                typeof value === "number" &&
                value === 1
            ) {

                return true;

            }

            if (
                typeof value === "string"
            ) {

                const normalized =
                    value
                        .trim()
                        .toLowerCase();

                if (
                    [
                        "true",
                        "1",
                        "yes",
                        "required",
                        "on",
                        "enabled",
                        "enable"
                    ].includes(
                        normalized
                    )
                ) {

                    return true;

                }

            }

        }

    }


    /*
    |--------------------------------------------------------------------------
    | password كـ object
    |--------------------------------------------------------------------------
    |
    | مثال:
    |
    | password: {
    |     required: true
    | }
    |
    |--------------------------------------------------------------------------
    */

    for (
        const source of sources
    ) {

        const password =
            source.password;

        if (
            password &&
            typeof password === "object"
        ) {

            if (
                password.required === true ||
                password.enabled === true ||
                passwordRequiredValue(
                    password.required
                ) ||
                passwordRequiredValue(
                    password.enabled
                )
            ) {

                return true;

            }

        }

    }


    /*
    |--------------------------------------------------------------------------
    | دعم login.passwordRequired
    |--------------------------------------------------------------------------
    */

    if (
        game.login &&
        typeof game.login === "object"
    ) {

        if (
            passwordRequiredValue(
                game.login.passwordRequired
            ) ||
            passwordRequiredValue(
                game.login.password_required
            )
        ) {

            return true;

        }

    }


    /*
    |--------------------------------------------------------------------------
    | دعم auth.passwordRequired
    |--------------------------------------------------------------------------
    */

    if (
        game.auth &&
        typeof game.auth === "object"
    ) {

        if (
            passwordRequiredValue(
                game.auth.passwordRequired
            ) ||
            passwordRequiredValue(
                game.auth.password_required
            )
        ) {

            return true;

        }

    }


    /*
    |--------------------------------------------------------------------------
    | مهم:
    |
    | وجود game.password وحده لا يعني بالضرورة أنه مطلوب.
    |
    | لكن إذا كان password عبارة عن boolean true
    | فسوف نعتبره طلب كلمة مرور.
    |--------------------------------------------------------------------------
    */

    if (
        game.password === true ||
        game.data?.password === true
    ) {

        return true;

    }


    return false;

}


/*
|--------------------------------------------------------------------------
| PASSWORD VALUE
|--------------------------------------------------------------------------
*/

function passwordRequiredValue(
    value
) {

    if (
        value === true
    ) {

        return true;

    }

    if (
        typeof value === "number" &&
        value === 1
    ) {

        return true;

    }

    if (
        typeof value === "string"
    ) {

        return [
            "true",
            "1",
            "yes",
            "required",
            "on",
            "enabled"
        ].includes(
            value
                .trim()
                .toLowerCase()
        );

    }

    return false;

}


/*
|--------------------------------------------------------------------------
| PASSWORD LABEL
|--------------------------------------------------------------------------
*/

function getPasswordLabel(game) {

    return cleanString(
        game?.passwordLabel ||
        game?.password_label ||
        game?.data?.passwordLabel ||
        game?.data?.password_label ||
        game?.auth?.passwordLabel ||
        game?.login?.passwordLabel ||
        "كلمة المرور",
        100
    );

}


/*
|--------------------------------------------------------------------------
| PASSWORD PLACEHOLDER
|--------------------------------------------------------------------------
*/

function getPasswordPlaceholder(game) {

    return cleanString(
        game?.passwordPlaceholder ||
        game?.password_placeholder ||
        game?.data?.passwordPlaceholder ||
        game?.data?.password_placeholder ||
        game?.auth?.passwordPlaceholder ||
        game?.login?.passwordPlaceholder ||
        "اكتب كلمة المرور...",
        150
    );

}


/*
|--------------------------------------------------------------------------
| STATS
|--------------------------------------------------------------------------
*/

function renderGameStats(profile) {

    const stats =
        profile?.stats || {};

    const games =
        numberValue(
            stats.games_played ??
            stats.games ??
            profile.games_played ??
            profile.games ??
            0
        );

    const wins =
        numberValue(
            stats.wins ??
            profile.wins ??
            0
        );

    const score =
        numberValue(
            stats.score ??
            stats.points ??
            profile.score ??
            profile.points ??
            0
        );

    return `

        <div class="game-stats">

            <div class="game-stat">

                <strong>
                    ${formatNumber(games)}
                </strong>

                <span>
                    مباراة
                </span>

            </div>

            <div class="game-stat">

                <strong>
                    ${formatNumber(wins)}
                </strong>

                <span>
                    فوز
                </span>

            </div>

            <div class="game-stat">

                <strong>
                    ${formatNumber(score)}
                </strong>

                <span>
                    نقطة
                </span>

            </div>

        </div>

    `;

}


/*
|--------------------------------------------------------------------------
| BUTTON EVENTS
|--------------------------------------------------------------------------
*/

function bindGameButtons(
    container
) {

    if (!container) {
        return;
    }

    container
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const action =
                        cleanString(
                            button.dataset.action,
                            50
                        );

                    const gameId =
                        cleanString(
                            button.dataset.game,
                            150
                        );

                    const game =
                        getGameById(
                            gameId
                        );

                    if (!game) {

                        showToast(
                            "اللعبة غير موجودة.",
                            "error"
                        );

                        return;

                    }

                    switch (action) {

                        case "link":

                            openLinkModal(
                                gameId
                            );

                            break;

                        case "play":

                            await startGame(
                                gameId,
                                button
                            );

                            break;

                        case "refresh":

                            await refreshGame(
                                gameId,
                                button
                            );

                            break;

                        case "unlink":

                            await unlinkGame(
                                gameId,
                                button
                            );

                            break;

                    }

                }
            );

        });

}


/*
|--------------------------------------------------------------------------
| OPEN LINK MODAL
|--------------------------------------------------------------------------
*/

function openLinkModal(
    gameId
) {

    const game =
        getGameById(
            gameId
        );

    if (!game) {
        return;
    }

    state.modalGameId =
        gameId;

    const modal =
        document.getElementById(
            "linkModal"
        );

    if (!modal) {
        return;
    }

    const input =
        document.getElementById(
            "usernameInput"
        );


    /*
    |--------------------------------------------------------------------------
    | الإصلاح الأساسي:
    |
    | HTML يستخدم passwordField
    | وليس passwordFieldGroup
    |--------------------------------------------------------------------------
    */

    const passwordGroup =
        document.getElementById(
            "passwordField"
        );


    const passwordInput =
        document.getElementById(
            "passwordInput"
        );


    /*
    |--------------------------------------------------------------------------
    | HTML الحالي لا يحتوي على passwordFieldLabel.
    |
    | لذلك نحصل على label من خلال for.
    |--------------------------------------------------------------------------
    */

    const passwordLabel =
        document.querySelector(
            'label[for="passwordInput"]'
        );


    const togglePassword =
        document.getElementById(
            "togglePasswordBtn"
        );


    const button =
        document.getElementById(
            "linkSubmitBtn"
        );


    /*
    |--------------------------------------------------------------------------
    | هل تحتاج اللعبة إلى كلمة مرور؟
    |--------------------------------------------------------------------------
    */

    const requiresPassword =
        gameRequiresPassword(
            game
        );


    console.log(
        "[BAQEZU]",
        "Game:",
        getGameName(game),
        "Password Required:",
        requiresPassword
    );


    /*
    |--------------------------------------------------------------------------
    | إصلاح إظهار الحقل
    |--------------------------------------------------------------------------
    */

    if (passwordGroup) {

        if (requiresPassword) {

            /*
            | إزالة كل أسباب الإخفاء
            */

            passwordGroup.classList.remove(
                "hidden"
            );

            passwordGroup.removeAttribute(
                "hidden"
            );

            passwordGroup.style.display =
                "block";

            passwordGroup.style.visibility =
                "visible";

            passwordGroup.style.opacity =
                "1";

        } else {

            /*
            | إخفاؤه
            */

            passwordGroup.classList.add(
                "hidden"
            );

            passwordGroup.setAttribute(
                "hidden",
                ""
            );

            passwordGroup.style.display =
                "none";

            passwordGroup.style.visibility =
                "hidden";

            passwordGroup.style.opacity =
                "0";

        }

    }


    /*
    |--------------------------------------------------------------------------
    | PASSWORD INPUT
    |--------------------------------------------------------------------------
    */

    if (passwordInput) {

        passwordInput.value = "";

        passwordInput.required =
            requiresPassword;

        passwordInput.disabled =
            !requiresPassword;

        passwordInput.type =
            "password";

        passwordInput.autocomplete =
            requiresPassword
                ? "current-password"
                : "off";

        passwordInput.placeholder =
            getPasswordPlaceholder(
                game
            );

    }


    /*
    |--------------------------------------------------------------------------
    | PASSWORD TOGGLE RESET
    |--------------------------------------------------------------------------
    */

    if (togglePassword) {

        togglePassword.textContent =
            "👁️";

        togglePassword.setAttribute(
            "aria-label",
            "إظهار كلمة المرور"
        );

        togglePassword.setAttribute(
            "title",
            "إظهار كلمة المرور"
        );

        togglePassword.disabled =
            !requiresPassword;

    }


    /*
    |--------------------------------------------------------------------------
    | LABEL
    |--------------------------------------------------------------------------
    */

    if (passwordLabel) {

        passwordLabel.textContent =
            getPasswordLabel(
                game
            );

    }


    /*
    |--------------------------------------------------------------------------
    | OPEN MODAL
    |--------------------------------------------------------------------------
    */

    modal.classList.remove(
        "hidden"
    );

    modal.removeAttribute(
        "hidden"
    );

    setModalMessage(
        "",
        ""
    );


    /*
    |--------------------------------------------------------------------------
    | USERNAME
    |--------------------------------------------------------------------------
    */

    if (input) {

        input.value = "";

        input.placeholder =
            cleanString(
                game.usernamePlaceholder ||
                game.username_placeholder ||
                "اكتب اسم اللاعب",
                150
            );

    }


    /*
    |--------------------------------------------------------------------------
    | SUBMIT
    |--------------------------------------------------------------------------
    */

    if (button) {

        button.disabled =
            false;

        button.textContent =
            cleanString(
                game.linkButtonText ||
                "ربط الحساب 🚀",
                100
            );

    }


    setModalGameText(
        game
    );


    /*
    |--------------------------------------------------------------------------
    | FOCUS
    |--------------------------------------------------------------------------
    */

    setTimeout(
        () => {

            input?.focus();

        },
        100
    );

}


/*
|--------------------------------------------------------------------------
| MODAL TITLE
|--------------------------------------------------------------------------
*/

function setModalGameText(
    game
) {

    const name =
        getGameName(
            game
        );

    [

        document.getElementById(
            "linkModalTitle"
        ),

        document.getElementById(
            "modalGameName"
        ),

        document.querySelector(
            "#linkModal [data-modal-game-name]"
        )

    ].forEach(
        element => {

            if (element) {

                element.textContent =
                    `ربط حساب ${name}`;

            }

        }
    );

}


/*
|--------------------------------------------------------------------------
| CLOSE MODAL
|--------------------------------------------------------------------------
*/

function closeLinkModal() {

    const modal =
        document.getElementById(
            "linkModal"
        );

    modal?.classList.add(
        "hidden"
    );

    state.modalGameId =
        null;


    /*
    |--------------------------------------------------------------------------
    | تنظيف كلمة المرور
    |--------------------------------------------------------------------------
    */

    const passwordInput =
        document.getElementById(
            "passwordInput"
        );

    if (passwordInput) {

        passwordInput.value = "";

        passwordInput.type =
            "password";

    }

}


/*
|--------------------------------------------------------------------------
| SUBMIT ACCOUNT
|--------------------------------------------------------------------------
*/

async function submitGameAccount() {

    if (state.actionLoading) {
        return;
    }

    const gameId =
        state.modalGameId;

    const game =
        getGameById(
            gameId
        );

    if (!game) {

        setModalMessage(
            "اللعبة غير موجودة.",
            "error"
        );

        return;

    }

    const input =
        document.getElementById(
            "usernameInput"
        );

    const passwordInput =
        document.getElementById(
            "passwordInput"
        );

    const button =
        document.getElementById(
            "linkSubmitBtn"
        );

    const username =
        cleanString(
            input?.value,
            150
        );


    /*
    |--------------------------------------------------------------------------
    | PASSWORD
    |--------------------------------------------------------------------------
    */

    const requiresPassword =
        gameRequiresPassword(
            game
        );

    const password =
        requiresPassword
            ? cleanString(
                passwordInput?.value,
                300
            )
            : "";


    /*
    |--------------------------------------------------------------------------
    | USERNAME VALIDATION
    |--------------------------------------------------------------------------
    */

    if (!username) {

        setModalMessage(
            "يرجى كتابة اسم اللاعب.",
            "error"
        );

        input?.focus();

        return;

    }


    /*
    |--------------------------------------------------------------------------
    | PASSWORD VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        requiresPassword &&
        !password
    ) {

        setModalMessage(
            "يرجى كتابة كلمة المرور.",
            "error"
        );

        passwordInput?.focus();

        return;

    }


    state.actionLoading =
        true;


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "جاري ربط الحساب...";

    }


    try {

        const result =
            await callLinkGame(
                gameId,
                username,
                password,
                game
            );

        if (
            !isSuccessResult(result)
        ) {

            throw new Error(
                getResultMessage(
                    result,
                    "تعذر ربط الحساب."
                )
            );

        }


        closeLinkModal();


        showToast(
            getResultMessage(
                result,
                "تم ربط الحساب بنجاح 🎉"
            ),
            "success"
        );


        await loadGames(
            false,
            true
        );


    } catch (error) {

        console.error(
            "[BAQEZU] LINK ERROR:",
            error
        );

        setModalMessage(
            getErrorMessage(
                error,
                "حدث خطأ أثناء ربط الحساب."
            ),
            "error"
        );

    } finally {

        state.actionLoading =
            false;

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "ربط الحساب 🚀";

        }

    }

}


/*
|--------------------------------------------------------------------------
| LINK API
|--------------------------------------------------------------------------
*/

async function callLinkGame(
    gameId,
    username,
    password,
    game
) {

    if (
        typeof window.baqezu?.linkGame ===
        "function"
    ) {

        return await window.baqezu.linkGame(
            gameId,
            username,
            password
        );

    }


    const apiName =
        getGameApiName(
            gameId,
            "link"
        );


    if (
        apiName &&
        typeof window.baqezu?.[apiName] ===
        "function"
    ) {

        return await window.baqezu[
            apiName
        ](
            username,
            password
        );

    }


    if (
        isLudoGame(gameId) &&
        typeof window.baqezu?.linkLudo ===
        "function"
    ) {

        return await window.baqezu.linkLudo(
            username,
            password
        );

    }


    throw new Error(
        `لا توجد دالة ربط للعبة "${getGameName(game)}".`
    );

}


/*
|--------------------------------------------------------------------------
| START GAME
|--------------------------------------------------------------------------
*/

async function startGame(
    gameId,
    button = null
) {

    if (state.actionLoading) {
        return;
    }

    const game =
        getGameById(
            gameId
        );

    if (!game) {

        showToast(
            "اللعبة غير موجودة.",
            "error"
        );

        return;

    }

    state.actionLoading =
        true;

    const oldText =
        button?.textContent ||
        getPlayLabel(
            game
        );

    setButtonLoading(
        button,
        true,
        "⏳ جاري فتح اللعبة..."
    );

    try {

        state.currentGameId =
            gameId;

        showToast(
            `جاري فتح ${getGameName(game)}...`,
            "info"
        );

        const result =
            await callOpenGame(
                gameId,
                game
            );

        if (
            result === false ||
            result?.success === false
        ) {

            throw new Error(
                getResultMessage(
                    result,
                    "تعذر فتح اللعبة."
                )
            );

        }

        showToast(
            getResultMessage(
                result,
                `تم فتح ${getGameName(game)} 🎮`
            ),
            "success"
        );

    } catch (error) {

        console.error(
            "[BAQEZU] OPEN ERROR:",
            error
        );

        const opened =
            tryOpenGameUrl(
                game
            );

        if (!opened) {

            showToast(
                getErrorMessage(
                    error,
                    "تعذر فتح اللعبة."
                ),
                "error"
            );

        }

    } finally {

        state.actionLoading =
            false;

        setButtonLoading(
            button,
            false,
            oldText
        );

    }

}


/*
|--------------------------------------------------------------------------
| OPEN GAME
|--------------------------------------------------------------------------
*/

async function callOpenGame(
    gameId,
    game
) {

    if (
        typeof window.baqezu?.openGame ===
        "function"
    ) {

        return await window.baqezu.openGame(
            gameId
        );

    }

    const apiName =
        getGameApiName(
            gameId,
            "open"
        );

    if (
        apiName &&
        typeof window.baqezu?.[apiName] ===
        "function"
    ) {

        return await window.baqezu[
            apiName
        ]();

    }

    if (
        isLudoGame(gameId) &&
        typeof window.baqezu?.openLudo ===
        "function"
    ) {

        return await window.baqezu.openLudo();

    }

    if (
        hasGameUrl(game)
    ) {

        if (
            tryOpenGameUrl(game)
        ) {

            return {
                success: true
            };

        }

    }

    throw new Error(
        `لا توجد طريقة لفتح "${getGameName(game)}".`
    );

}


/*
|--------------------------------------------------------------------------
| OPEN URL
|--------------------------------------------------------------------------
*/

function tryOpenGameUrl(game) {

    const url =
        getGameUrl(
            game
        );

    if (!url) {
        return false;
    }

    try {

        if (
            typeof window.baqezu?.openExternal ===
            "function"
        ) {

            window.baqezu.openExternal(
                url
            );

            return true;

        }

        if (
            typeof window.baqezu?.openUrl ===
            "function"
        ) {

            window.baqezu.openUrl(
                url
            );

            return true;

        }

        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );

        return true;

    } catch (error) {

        console.error(
            "[BAQEZU] URL ERROR:",
            error
        );

        return false;

    }

}


/*
|--------------------------------------------------------------------------
| GAME URL
|--------------------------------------------------------------------------
*/

function getGameUrl(game) {

    const values = [

        game?.gameUrl,

        game?.game_url,

        game?.url,

        game?.playUrl,

        game?.play_url,

        game?.launchUrl,

        game?.launch_url,

        game?.website,

        game?.websiteUrl,

        game?.data?.gameUrl,

        game?.data?.url

    ];

    for (
        const value of values
    ) {

        const url =
            cleanString(
                value,
                2000
            );

        if (
            /^https?:\/\//i.test(url) ||
            /^file:\/\//i.test(url)
        ) {

            return url;

        }

    }

    return "";

}


function hasGameUrl(game) {

    return Boolean(
        getGameUrl(game)
    );

}


/*
|--------------------------------------------------------------------------
| GAME API
|--------------------------------------------------------------------------
*/

function getGameApiName(
    gameId,
    action
) {

    const game =
        getGameById(
            gameId
        );

    if (!game) {
        return "";
    }

    const api =
        game.api ||
        game.apis ||
        game.apiMethods ||
        {};

    if (
        api &&
        typeof api === "object"
    ) {

        return cleanString(
            api[action],
            150
        );

    }

    return cleanString(
        game[
            action +
            "Function"
        ],
        150
    );

}


/*
|--------------------------------------------------------------------------
| LUDO
|--------------------------------------------------------------------------
*/

function isLudoGame(
    gameId
) {

    const id =
        cleanString(
            gameId,
            150
        ).toLowerCase();

    return (
        id === "ludo" ||
        id === "ludo_game" ||
        id.includes("ludo")
    );

}


/*
|--------------------------------------------------------------------------
| REFRESH GAME
|--------------------------------------------------------------------------
*/

async function refreshGame(
    gameId,
    button = null
) {

    if (state.actionLoading) {
        return;
    }

    const game =
        getGameById(
            gameId
        );

    if (!game) {
        return;
    }

    state.actionLoading =
        true;

    const oldText =
        button?.textContent ||
        "↻ تحديث";

    setButtonLoading(
        button,
        true,
        "جاري التحديث..."
    );

    try {

        const result =
            await callRefreshGame(
                gameId,
                game
            );

        if (
            result?.success === false
        ) {

            throw new Error(
                getResultMessage(
                    result,
                    "تعذر تحديث الحساب."
                )
            );

        }

        showToast(
            getResultMessage(
                result,
                "تم تحديث البيانات بنجاح."
            ),
            "success"
        );

        await loadGames(
            false,
            true
        );

    } catch (error) {

        showToast(
            getErrorMessage(
                error,
                "تعذر تحديث البيانات."
            ),
            "error"
        );

    } finally {

        state.actionLoading =
            false;

        setButtonLoading(
            button,
            false,
            oldText
        );

    }

}


async function callRefreshGame(
    gameId,
    game
) {

    if (
        typeof window.baqezu?.refreshGame ===
        "function"
    ) {

        return await window.baqezu.refreshGame(
            gameId
        );

    }

    const apiName =
        getGameApiName(
            gameId,
            "refresh"
        );

    if (
        apiName &&
        typeof window.baqezu?.[apiName] ===
        "function"
    ) {

        return await window.baqezu[
            apiName
        ]();

    }

    if (
        isLudoGame(gameId) &&
        typeof window.baqezu?.refreshLudo ===
        "function"
    ) {

        return await window.baqezu.refreshLudo();

    }

    await loadGames(
        false,
        true
    );

    return {
        success: true
    };

}


/*
|--------------------------------------------------------------------------
| UNLINK
|--------------------------------------------------------------------------
*/

async function unlinkGame(
    gameId,
    button = null
) {

    if (state.actionLoading) {
        return;
    }

    const game =
        getGameById(
            gameId
        );

    if (!game) {
        return;
    }

    if (
        !window.confirm(
            `هل أنت متأكد من فصل حساب ${getGameName(game)}؟`
        )
    ) {

        return;

    }

    state.actionLoading =
        true;

    const oldText =
        button?.textContent ||
        "فصل الحساب";

    setButtonLoading(
        button,
        true,
        "جاري الفصل..."
    );

    try {

        const result =
            await callUnlinkGame(
                gameId,
                game
            );

        if (
            result?.success === false
        ) {

            throw new Error(
                getResultMessage(
                    result,
                    "تعذر فصل الحساب."
                )
            );

        }

        showToast(
            getResultMessage(
                result,
                "تم فصل الحساب بنجاح."
            ),
            "success"
        );

        await loadGames(
            false,
            true
        );

    } catch (error) {

        showToast(
            getErrorMessage(
                error,
                "تعذر فصل الحساب."
            ),
            "error"
        );

    } finally {

        state.actionLoading =
            false;

        setButtonLoading(
            button,
            false,
            oldText
        );

    }

}


async function callUnlinkGame(
    gameId,
    game
) {

    if (
        typeof window.baqezu?.unlinkGame ===
        "function"
    ) {

        return await window.baqezu.unlinkGame(
            gameId
        );

    }

    const apiName =
        getGameApiName(
            gameId,
            "unlink"
        );

    if (
        apiName &&
        typeof window.baqezu?.[apiName] ===
        "function"
    ) {

        return await window.baqezu[
            apiName
        ]();

    }

    if (
        isLudoGame(gameId) &&
        typeof window.baqezu?.unlinkLudo ===
        "function"
    ) {

        return await window.baqezu.unlinkLudo();

    }

    throw new Error(
        `لا توجد دالة فصل للعبة "${getGameName(game)}".`
    );

}


/*
|--------------------------------------------------------------------------
| ACCOUNTS
|--------------------------------------------------------------------------
*/

function renderAccounts(
    games
) {

    const container =
        document.getElementById(
            "accountsList"
        );

    if (!container) {
        return;
    }

    const linked =
        games.filter(
            isGameLinked
        );

    if (!linked.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    👤
                </div>

                <h3>
                    لا توجد حسابات مرتبطة
                </h3>

                <p>
                    لم يتم ربط أي حساب لعبة بعد.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        linked
            .map(
                game => {

                    const profile =
                        getGameProfile(
                            game
                        );

                    const username =
                        getUsername(
                            profile
                        );

                    const id =
                        getPlayerId(
                            profile
                        );

                    return `

                        <div class="account-card">

                            <div class="brand-icon">

                                ${renderGameVisual(
                                    getGameImage(game),
                                    getGameIcon(game),
                                    getGameName(game)
                                )}

                            </div>

                            <div class="account-info">

                                <h3>
                                    ${escapeHtml(
                                        username
                                    )}
                                </h3>

                                <p>

                                    ${escapeHtml(
                                        getGameName(game)
                                    )}

                                    ${
                                        id
                                            ? ` • ${escapeHtml(id)}`
                                            : ""
                                    }

                                </p>

                            </div>

                            <div class="status-badge linked">
                                مربوط
                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/*
|--------------------------------------------------------------------------
| STATISTICS
|--------------------------------------------------------------------------
*/

function renderStatistics(
    games
) {

    let linked = 0;

    let wins = 0;

    let score = 0;

    let played = 0;

    games.forEach(
        game => {

            if (
                !isGameLinked(game)
            ) {

                return;

            }

            linked++;

            const profile =
                getGameProfile(
                    game
                );

            const stats =
                profile.stats || {};

            wins += numberValue(
                stats.wins ??
                profile.wins ??
                0
            );

            score += numberValue(
                stats.score ??
                stats.points ??
                profile.score ??
                profile.points ??
                0
            );

            played += numberValue(
                stats.games_played ??
                stats.games ??
                profile.games_played ??
                profile.games ??
                0
            );

        }
    );

    setText(
        "linkedGamesCount",
        formatNumber(linked)
    );

    setText(
        "totalWins",
        formatNumber(wins)
    );

    setText(
        "totalScore",
        formatNumber(score)
    );

    setText(
        "totalGames",
        formatNumber(played)
    );

}


/*
|--------------------------------------------------------------------------
| CLEAR DATA
|--------------------------------------------------------------------------
*/

async function clearAllData() {

    if (state.actionLoading) {
        return;
    }

    if (
        !window.confirm(
            "هل تريد حذف جميع البيانات المحلية؟"
        )
    ) {

        return;

    }

    if (
        typeof window.baqezu?.clearData !==
        "function"
    ) {

        showToast(
            "دالة حذف البيانات غير متوفرة.",
            "error"
        );

        return;

    }

    state.actionLoading =
        true;

    try {

        const result =
            await window.baqezu.clearData();

        if (
            !isSuccessResult(result)
        ) {

            throw new Error(
                getResultMessage(
                    result,
                    "تعذر حذف البيانات."
                )
            );

        }

        state.games = {};

        renderAll();

        showToast(
            getResultMessage(
                result,
                "تم حذف البيانات."
            ),
            "success"
        );

        await loadGames(
            false,
            true
        );

    } catch (error) {

        showToast(
            getErrorMessage(
                error,
                "تعذر حذف البيانات."
            ),
            "error"
        );

    } finally {

        state.actionLoading =
            false;

    }

}


/*
|--------------------------------------------------------------------------
| MODAL MESSAGE
|--------------------------------------------------------------------------
*/

function setModalMessage(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "modalMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        cleanString(
            message,
            500
        );

    element.className =
        "modal-message";

    if (type) {

        element.classList.add(
            type
        );

    }

}


/*
|--------------------------------------------------------------------------
| CONNECTION
|--------------------------------------------------------------------------
*/

function updateConnectionStatus() {

    const online =
        navigator.onLine !== false;

    const dot =
        document.getElementById(
            "connectionDot"
        );

    const text =
        document.getElementById(
            "connectionText"
        );

    dot?.classList.toggle(
        "online",
        online
    );

    dot?.classList.toggle(
        "offline",
        !online
    );

    if (text) {

        text.textContent =
            online
                ? "متصل بالإنترنت"
                : "غير متصل";

    }

}


/*
|--------------------------------------------------------------------------
| ERROR STATE
|--------------------------------------------------------------------------
*/

function renderErrorState(
    message
) {

    [
        "homeGamesList",
        "gamesLibrary",
        "accountsList"
    ].forEach(
        id => {

            const container =
                document.getElementById(
                    id
                );

            if (!container) {
                return;
            }

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        حدث خطأ
                    </h3>

                    <p>
                        ${escapeHtml(
                            message
                        )}
                    </p>

                    <button
                        type="button"
                        class="primary-btn retry-load-btn"
                    >
                        إعادة المحاولة
                    </button>

                </div>

            `;

            container
                .querySelector(
                    ".retry-load-btn"
                )
                ?.addEventListener(
                    "click",
                    () =>
                        loadGames(
                            false,
                            true
                        )
                );

        }
    );

}


/*
|--------------------------------------------------------------------------
| TOAST
|--------------------------------------------------------------------------
*/

function showToast(
    message,
    type = "info"
) {

    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {
        return;
    }

    if (state.toastTimer) {

        clearTimeout(
            state.toastTimer
        );

    }

    const safeType =
        [
            "success",
            "error",
            "warning",
            "info"
        ].includes(type)
            ? type
            : "info";

    toast.textContent =
        cleanString(
            message,
            500
        );

    toast.className =
        `toast show ${safeType}`;

    state.toastTimer =
        setTimeout(
            () => {

                toast.className =
                    "toast";

                state.toastTimer =
                    null;

            },
            3500
        );

}


/*
|--------------------------------------------------------------------------
| BUTTON LOADING
|--------------------------------------------------------------------------
*/

function setButtonLoading(
    button,
    loading,
    text
) {

    if (!button) {
        return;
    }

    button.disabled =
        loading;

    if (
        text !== undefined
    ) {

        button.textContent =
            text;

    }

}


/*
|--------------------------------------------------------------------------
| SUCCESS RESULT
|--------------------------------------------------------------------------
*/

function isSuccessResult(
    result
) {

    if (
        result === false ||
        result === null ||
        result === undefined
    ) {

        return false;

    }

    if (
        typeof result === "object" &&
        result.success === false
    ) {

        return false;

    }

    return true;

}


/*
|--------------------------------------------------------------------------
| RESULT MESSAGE
|--------------------------------------------------------------------------
*/

function getResultMessage(
    result,
    fallback
) {

    if (
        result &&
        typeof result === "object"
    ) {

        return cleanString(
            result.message ||
            result.msg ||
            result.error ||
            fallback,
            500
        );

    }

    return fallback;

}


/*
|--------------------------------------------------------------------------
| ERROR MESSAGE
|--------------------------------------------------------------------------
*/

function getErrorMessage(
    error,
    fallback
) {

    if (
        error?.message
    ) {

        return cleanString(
            error.message,
            500
        );

    }

    if (
        typeof error === "string"
    ) {

        return cleanString(
            error,
            500
        );

    }

    return fallback;

}


/*
|--------------------------------------------------------------------------
| NUMBER
|--------------------------------------------------------------------------
*/

function numberValue(
    value
) {

    if (
        typeof value === "string"
    ) {

        value =
            value
                .replace(
                    /,/g,
                    ""
                )
                .trim();

    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


/*
|--------------------------------------------------------------------------
| FORMAT NUMBER
|--------------------------------------------------------------------------
*/

function formatNumber(
    value
) {

    try {

        return new Intl.NumberFormat(
            "ar-IQ"
        ).format(
            numberValue(value)
        );

    } catch {

        return String(
            numberValue(value)
        );

    }

}


/*
|--------------------------------------------------------------------------
| SET TEXT
|--------------------------------------------------------------------------
*/

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {

        element.textContent =
            value;

    }

}


/*
|--------------------------------------------------------------------------
| CLEAN STRING
|--------------------------------------------------------------------------
*/

function cleanString(
    value,
    maxLength = 500
) {

    return String(
        value ?? ""
    )
        .trim()
        .slice(
            0,
            maxLength
        );

}


/*
|--------------------------------------------------------------------------
| ESCAPE HTML
|--------------------------------------------------------------------------
*/

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
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


/*
|--------------------------------------------------------------------------
| PUBLIC API
|--------------------------------------------------------------------------
*/

window.showPage =
    showPage;


window.baqezuRenderer =
    Object.freeze({

        reloadGames:
            () =>
                loadGames(
                    false,
                    true
                ),

        getGames:
            () =>
                getGameList(),

        getGame:
            gameId =>
                getGameById(
                    gameId
                ),

        getState:
            () => ({

                games:
                    state.games,

                loading:
                    state.loading,

                actionLoading:
                    state.actionLoading,

                currentPage:
                    state.currentPage,

                currentGameId:
                    state.currentGameId,

                modalGameId:
                    state.modalGameId

            }),

        openGame:
            gameId =>
                startGame(
                    gameId
                ),

        refreshGame:
            gameId =>
                refreshGame(
                    gameId
                ),

        unlinkGame:
            gameId =>
                unlinkGame(
                    gameId
                ),

        requiresPassword:
            gameId => {

                const game =
                    getGameById(
                        gameId
                    );

                return gameRequiresPassword(
                    game
                );

            },

        openLinkModal:
            gameId =>
                openLinkModal(
                    gameId
                )

    });


/*
|--------------------------------------------------------------------------
| DEBUG
|--------------------------------------------------------------------------
*/

console.log(
    "[BAQEZU HUB] Universal Renderer 6.0 Ready"
);

console.log(
    "[BAQEZU HUB] Password system fixed."
);