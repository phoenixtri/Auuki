import { xf } from '../functions.js';

// TODO:
// - split the view logic
// - extract handlers
function API() {
    const api_uri = process.env.API_URI;
    const pwa_uri = process.env.PWA_URI;
    const strava_client_id = process.env.STRAVA_CLIENT_ID;

    // DOM
    const $registerForm = document.querySelector('#register--form');
    const $loginForm = document.querySelector('#login--form');
    const $logoutButton = document.querySelector('#logout--button');
    const $uploadWorkoutButton = document.querySelector('#upload--button');

    const $stravaConnectButton = document.querySelector('#strava--connect--button');

    // Sub
    let abortController = new AbortController();
    let signal = { signal: abortController.signal };

    $registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        register();
    }, signal);

    $loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        login();
    }, signal);

    $logoutButton.addEventListener('pointerup', (e) => {
        logout();
    }, signal);

    $uploadWorkoutButton.addEventListener('pointerup', (e) => {
        xf.dispatch('ui:activity:send');
    }, signal);

    $stravaConnectButton.addEventListener('pointerup', (e) => {
        strava_connect();
    });

    // Handlers
    async function register() {
        const url = `${api_uri}/api/register`;
        const formData = new FormData($registerForm);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                body: JSON.stringify(Object.fromEntries(formData)),
            });

            const status = response.status;
            const json = await response.json();

            // TODO: remove
            console.log(json);

            if(json.error) {
                console.log(`register: ui:auth-set :error`);
                xf.dispatch('ui:auth-set', ':error');
                return;
            }
            if(json?.result?.success) {
                console.log(`register: ui:auth-set :login`);
                xf.dispatch('ui:auth-set', ':login');
                return;
            }

            console.log(`register: :none`);
        } catch(error) {
            console.log(error);
        }
    }

    async function login() {
        const url = `${api_uri}/api/login`;
        const formData = new FormData($loginForm);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify(Object.fromEntries(formData)),
            });

            const json = await response.json();

            // TODO: remove
            console.log(json);

            if(json.error) {
                console.log(`login: ui:auth-set :error`);
                xf.dispatch('ui:auth-set', ':error');
                return;
            }

            if(json?.result?.success) {
                console.log(`login: ui:auth-set :profile`);
                xf.dispatch('ui:auth-set', ':profile');
                return;
            }

            console.log(`login: :none`);
        } catch(error) {
            console.log(error);
        }
    }

    async function logout() {
        const url = `${api_uri}/api/logout`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify({logout: true}),
            });

            const result = await response.json();
            xf.dispatch('ui:auth-set', ':login');
        } catch(error) {
            console.log(error);
        }
    }

    async function upload_workout_strava(blob) {
        const url = `${api_uri}/api/strava/upload`;

        const formData = new FormData();
        formData.append('file', blob);
        // formData.append('data_type', 'fit');

        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const result = await response.json();
        } catch(error) {
            console.log(error);
        }
    }

    // Step 1
    async function strava_connect() {
        const url =
              'https://www.strava.com/oauth/authorize' +
              '?' +
              new URLSearchParams({
                  client_id: strava_client_id,
                  redirect_uri: pwa_uri,
                  // redirect_uri: 'http://localhost:1234/',
                  response_type: 'code',
                  scope: 'activity:write',
              }).toString();
        window.location.replace(url);

        // const url = `${api_uri}/api/strava/oauth/authorize`;

        // try {
        //     const response = await fetch(url, {
        //         method: 'POST',
        //         credentials: 'include',
        //     });

        //     const result = await response.text();
        //     console.log(result);
        // } catch(error) {
        //     console.log(error);
        // }
    }

    async function strava_disconnect() {
        const url = "https://www.strava.com/oauth/deauthorize";
    }

    // Step 3
    async function handleStravaRedirect() {
        const params = (new URL(document.location)).searchParams;
        const state  = params.get('state');
        const code   = params.get('code');
        const scope  = params.get('scope');
        const error  = params.get('error');

        if(error) {
            console.error(`Strava authorize step 1 error `, error);
        }

        if(code && scope && !error) {
            const url = `${api_uri}/api/strava/oauth/code` +
                '?' +
                new URLSearchParams({
                    state: state ?? '',
                    code: code,
                    scope: scope,
                })
                .toString();

            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
            });

            const result = await response.text();
            console.log(result);

            window.history.pushState({}, document.title, window.location.pathname);
        }
    }


    async function status() {
        const url = `${api_uri}/api/rpc`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify({
                    id: crypto.randomUUID(),
                    method: 'status_handler',
                    params: {data: {}},
                }),
            });

            console.log(response);
            const status = response.status;

            if(status === 200) {
                console.log(`Profile`);
                xf.dispatch('ui:auth-set', ':profile');
            }
            if(status === 403) {
                console.log(`No Auth`);
                xf.dispatch('ui:auth-set', ':login');
            }
            if(status === 500) {
                console.log(`No API`);
                xf.dispatch('ui:auth-set', ':no-api');
            }
        } catch(error) {
            console.log(error);
        }
    }

    function onLoad() {
        handleStravaRedirect();
    }

    onLoad();

    return Object.freeze({
        upload_workout_strava,
        status,
    });
}

export default API;

