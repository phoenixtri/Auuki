import { xf, print, } from '../functions.js';
import { OAuthService, DialogMsg, stateParam, } from './enums.js';

function Strava(args = {}) {
    const config = args.config;
    const api_uri = config.API_URI;
    const pwa_uri = config.PWA_URI;
    const strava_client_id = config.STRAVA_CLIENT_ID;
    const serviceName = OAuthService.strava;

    // Step D
    async function connect() {
        const scope = 'activity:write';
        const state = stateParam.encode(serviceName);
        stateParam.store(state);

        const url =
              'https://www.strava.com/oauth/authorize' +
              '?' +
              new URLSearchParams({
                  client_id: strava_client_id,
                  redirect_uri: pwa_uri,
                  response_type: 'code',
                  state,
                  scope,
              }).toString();
        console.log(url);
        window.location.replace(url);
    }

    async function disconnect() {
        // TODO:
        const url = "https://www.strava.com/oauth/deauthorize";
    }

    // Step 3
    async function paramsHandler(args = {}) {
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
            print.log(result);
            clearParams();
        } catch (e) {
            console.log(``, e);
        }
    }

    function clearParams() {
        window.history.pushState({}, document.title, window.location.pathname);
    }

    async function uploadWorkout(blob) {
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
                    print.log(`:api :no-auth`);
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

    return Object.freeze({
        connect,
        disconnect,
        paramsHandler,
        uploadWorkout,
    });
}

export default Strava;

