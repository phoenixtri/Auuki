import { exists, xf, print, } from '../functions.js';
import { DialogMsg } from './enums.js';
import { uuid } from '../storage/uuid.js';

// TODO:
// - split the remaining view logic
// - extract handlers
function API() {
    var process = process ?? {
        env: {
            API_URI: "http://localhost:8080",
            PWA_URI: "http://localhost:1234",
            STRAVA_CLIENT_ID: 0,
        }
    };

    const api_uri = process.env.API_URI;
    const pwa_uri = process.env.PWA_URI;
    const strava_client_id = process.env.STRAVA_CLIENT_ID;

    // DOM
    const $stravaConnectButton = document.querySelector('#strava--connect--button');

    // Sub
    let abortController = new AbortController();
    let signal = { signal: abortController.signal };

    $stravaConnectButton.addEventListener('pointerup', (e) => {
        strava_connect();
    }, signal);

    // Handlers

    // {data: {FormData}} -> Void
    async function register(args = {}) {
        const url = `${api_uri}/api/register`;
        const data = args.data;

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
                console.log(':api :register :error');
                xf.dispatch('action:auth', ':error');
                return;
            }
            if(json?.result?.success) {
                console.log(':api :register :success');
                xf.dispatch('action:auth', ':password:login');
                return;
            }

            console.log(`register: :none`);
        } catch(error) {
            console.log(error);
        }
    }

    // {data: {FormData}} -> Void
    async function login(args = {}) {
        const url = `${api_uri}/api/login`;
        const data = args.data;

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
                console.log(`:api :login :error`);
                xf.dispatch('action:auth', ':error');
                return;
            }

            if(json?.result?.success) {
                console.log(`:api :login :success`);
                xf.dispatch('action:auth', ':password:profile');
                return;
            }

            console.log(`:api :login :none`);
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
            console.log(`:api :logout :success`);
            xf.dispatch('action:auth', ':password:logout');
        } catch(error) {
            console.log(error);
        }
    }

    // {data: {FormData}} -> Void
    async function forgot(args = {}) {
        const url = `${api_uri}/api/forgot-password`;
        const data = args.data;

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

            console.log(`:api :forgot :success`);
            xf.dispatch('action:auth', ':password:login');
            // TODO: display message email has been send if email exists
        } catch(error) {
            console.log(error);
        }
    }

    // {data: {FormData}} -> Void
    async function reset(args = {}) {
        const params = (new URL(document.location)).searchParams;
        const token = params.get('token') ?? '';

        const url = `${api_uri}/api/reset-password` + '?' +
              new URLSearchParams({token,}).toString();

        const data = args.data;

        if(data.password.trim() === '' ||
           data.password_confirmation.trim() === '') {
            return;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                body: JSON.stringify(data),
            });

            if(response.ok) {
                console.log(`:api :reset :success`);
                // TODO: remove the query params
                // clear();
            } else {
                console.error(`:api :reset :fail`);
            }
        } catch(e) {
            console.error(`:api :reset :error `, e);
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
                    console.log(`:api :no-auth`);
                    xf.dispatch('action:auth', ':password:login');

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
    async function strava_params_handler(args = {}) {
        const state = args.state ?? '';
        const code = args.code ?? '';
        const scope = args.scope ?? '';

        const url = `${api_uri}/api/strava/oauth/code` +
              '?' +
              new URLSearchParams({
                  state: state,
                  code: code,
                  scope: scope,
              })
              .toString();

        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
            });

            const result = await response.text();
            console.log(result);
        } catch (e) {
            console.log(``, e);
        }
    }

    async function onQueryParams() {
        const params = (new URL(document.location)).searchParams;
        let hasParams = params.size > 0;
        if(!hasParams) return;

        // strava params
        const state  = params.get('state');
        const code   = params.get('code');
        const scope  = params.get('scope');
        const error  = params.get('error');
        // reset param
        const token = params.get('token');

        // switch
        if(error) {
            console.error(`param error `, error);
        }
        if(!error && code && scope) {
            await strava_params_handler({state, code, scope});
        }
        if(!error && token) {
            return;
        }
        clear();
    }

    function clear() {
        window.history.pushState({}, document.title, window.location.pathname);
    }

    async function status() {
        const url = `${api_uri}/api/rpc`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify({
                    id: uuid(),
                    method: 'status_handler',
                    params: {data: {}},
                }),
            });

            // console.log(response);
            const status = response.status;

            if(status === 200) {
                console.log(`:api :profile`);
                xf.dispatch('action:auth', ':password:profile');
            }
            if(status === 403) {
                console.log(`:api :no-auth`);
                xf.dispatch('action:auth', ':password:login');
            }
            if(status === 500 || status === 405) {
                console.log(`:api :no-api`);
                xf.dispatch('action:auth', ':no-api');
            }
        } catch(error) {
            console.log(`:api :no-api`);
            xf.dispatch('action:auth', ':no-api');
            console.log(error);
        }
    }

    function onLoad() {
        onQueryParams();
    }

    onLoad();

    return Object.freeze({
        register,
        login,
        logout,
        forgot,
        reset,
        upload_workout_strava,
        status,
    });
}

export default API;

