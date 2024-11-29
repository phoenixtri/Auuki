import { xf, print, } from '../functions.js';
import { OAuthService, DialogMsg, stateParam, } from './enums.js';

function Intervals(args = {}) {
    const config = args.config;
    const api_uri = config.API_URI;
    const pwa_uri = config.PWA_URI;
    const intervals_client_id = config.INTERVALS_CLIENT_ID;
    const serviceName = OAuthService.intervals;

    // Step D
    async function connect() {
        const scope = 'ACTIVITY:WRITE,CALENDAR:READ';
        const state = stateParam.encode(serviceName);
        stateParam.store(state);

        const url =
              'https://intervals.icu/oauth/authorize' +
              '?' +
              new URLSearchParams({
                  client_id: intervals_client_id,
                  redirect_uri: pwa_uri,
                  scope,
                  state,
              }).toString();
        window.location.replace(url);
    }

    async function disconnect() {
        // TODO:
        const url = "https://intervals.icu/oauth/deauthorize";
    }

    // Step 3
    async function paramsHandler(args = {}) {
        const state = args.state ?? '';
        const code = args.code ?? '';
        const scope = args.scope ?? '';

        const url = `${api_uri}/api/intervals/oauth/code` +
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
        const url = `${api_uri}/api/intervals/upload`;

        const formData = new FormData();
        formData.append('file', blob);

        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if(response.ok) {
                return ':success';
            } else {
                if(response.status === 403) {
                    console.log(`:api :no-auth`);
                    xf.dispatch('action:auth', ':password:login');

                    xf.dispatch('ui:modal:error:open', DialogMsg.noAuth);
                }
                return ':fail';
            }
        } catch(error) {
            console.log(error);
            return ':fail';
        }
    }

    return Object.freeze({
        connect,
        disconnect,
        paramsHandler,
        uploadWorkout,
    });
}

export default Intervals;

