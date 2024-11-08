import { exists, xf } from '../functions.js';
import { DialogMsg } from './enums.js';

// TODO:
// - split the view logic
// - extract handlers
function API() {
    if(!exists(process)) {
        var process = {
            env: {}
        };
    }

    const api_uri = process.env.API_URI ?? '';
    const pwa_uri = process.env.PWA_URI ?? '';
    const strava_client_id = process.env.STRAVA_CLIENT_ID ?? 0;

    // DOM
    const $registerForm = document.querySelector('#register--form');
    const $loginForm = document.querySelector('#login--form');
    const $resetForm = document.querySelector('#reset--form');
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

    $resetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        request_password_reset();
    }, signal);

    $stravaConnectButton.addEventListener('pointerup', (e) => {
        strava_connect();
    });

    // Handlers
    async function register() {
        const url = `${api_uri}/api/register`;
        const formData = new FormData($registerForm);

        const data = Object.fromEntries(formData);

        if(data.email.trim() === '' ||
           data.password.trim() === '' ||
           data.password_confirmation.trim() === ''
          ) {
            return;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                body: JSON.stringify(data),
            });

            const status = response.status;
            const json = await response.json();

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
        } finally {
            $registerForm.reset();
        }
    }

    async function login() {
        const url = `${api_uri}/api/login`;
        const formData = new FormData($loginForm);

        const data = Object.fromEntries(formData);

        if(data.email.trim() === '' || data.password.trim() === '') {
            return;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify(data),
            });

            const json = await response.json();

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
        } finally {
            $loginForm.reset();
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

    async function request_password_reset() {
        const url = `${api_uri}/api/request-reset`;
        const formData = new FormData($resetForm);

        const data = Object.fromEntries(formData);

        if(data.email.trim() === '') {
            return;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify(data),
            });

            xf.dispatch('ui:auth-set', ':login');
        } catch(error) {
            console.log(error);
        } finally {
            $resetForm.reset();
        }
    }

    async function upload_workout_strava(blob) {
        const url = `${api_uri}/api/strava/upload`;

        const formData = new FormData();
        formData.append('file', blob);

        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if(response.ok) {
                return {success: true};
            } else {
                if(response.status === 403) {
                    console.log(`No Auth`);
                    xf.dispatch('ui:auth-set', ':login');
                    xf.dispatch('ui:modal:error:open', DialogMsg.noAuth);
                }
                return {success: false};
            }
        } catch(error) {
            console.log(error);
            return {success: false};
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
                  response_type: 'code',
                  scope: 'activity:write',
              }).toString();
        window.location.replace(url);
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

            // console.log(response);
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

