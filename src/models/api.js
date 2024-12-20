import { exists, xf, print, } from '../functions.js';
import { OAuthService, DialogMsg, stateParam, } from './enums.js';
import { uuid } from '../storage/uuid.js';
import Strava from './strava.js';
import Intervals from './intervals.js';
import TrainingPeaks from './training-peaks.js';
import Auth from './auth.js';



class Config {
    #defaultStravaClientId = 0;
    #defaultIntervalsClientId = 0;
    #defaultTrainingPeaksClientId = 0;

    constructor() {
        this.env = {
            // PWA_URI: "http://localhost:1234",
            // API_URI: "http://localhost:8080",
            PWA_URI: "https://dev.auuki.com",
            API_URI: "https://api.auuki.com",
            STRAVA_CLIENT_ID: this.defaultStravaClientId,
            INTERVALS_CLIENT_ID: this.defaultIntervalsClientId,
            TRAINING_PEAKS_CLIENT_ID: this.defaultTrainingPeaksClientId,
        };
    }
    setServices(args = {}) {
        this.env.STRAVA_CLIENT_ID = args.strava ?? this.defaultStravaClientId;
        this.env.INTERVALS_CLIENT_ID = args.intervals ?? this.defaultIntervalsClientId;
        this.env.TRAINING_PEAKS_CLIENT_ID = args.trainingPeaks ?? this.defaultTrainingPeaksClientId;
        Object.freeze(this.env);
    }
    get() {
        return this.env;
    }
}

// TODO:
// - call status() first than handle params and other routing
// - setup service config after status()
function API() {
    const config = new Config();
    const auth = Auth({config,});
    const strava = Strava({config,});
    const intervals = Intervals({config,});
    const trainingPeaks = TrainingPeaks({config,});
    const router = Router({config, handlers: {strava, intervals, trainingPeaks, auth},});

    async function start() {
        router.start();
    }

    function stop() {
    }

    return Object.freeze({
        auth,
        strava,
        intervals,
        trainingPeaks,
        start,
        stop,
    });
}

// TODO: create a proper minimalist router
function Router(args = {}) {
    const strava = args.handlers.strava;
    const intervals = args.handlers.intervals;
    const trainingPeaks = args.handlers.trainingPeaks;
    const auth = args.handlers.auth;

    async function start() {
        const status = await auth.status();
        args.config.setServices(status.services);
        strava.update();
        intervals.update();
        trainingPeaks.update();

        const params = getParams();
        if(hasParams(params)) {
            console.log(params);
            await onQueryParams(params);
        } else {
            // TODO: remove
            // get list of planned events once per period
            if(status.intervals) {
            }
        }
        return;
    }

    function getParams() {
        return (new URL(document.location)).searchParams;
    }

    function hasParams(params) {
        if(params) {
            return params.size > 0;
        } else {
            const params = (new URL(document.location)).searchParams;
            return params.size > 0;
        }
    }

    async function onQueryParams(params) {
        // strava params
        const state  = params.get('state');
        const code   = params.get('code');
        const scope  = params.get('scope');
        const error  = params.get('error');
        const token = params.get('token');

        // switch
        if(error) {
            console.error(`:api :param :error `, error);
            return true;
        }
        if(!error && (code || scope || state)) {
            const { service, id } = stateParam.decode(state);

            if(service === OAuthService.strava) {
                await strava.paramsHandler({state, code, scope});
            }
            if(service === OAuthService.intervals) {
                await intervals.paramsHandler({state, code, scope});
            }
            return true;
        }
        if(!error && token) {
            xf.dispatch('ui:page-set', 'settings');
            xf.dispatch('action:nav', 'settings:profile');
            xf.dispatch('action:auth', ':password:reset');
            return true;
        }
        // clearParams();
        return false;
    }

    function clearParams() {
        window.history.pushState({}, document.title, window.location.pathname);
    }

    return Object.freeze({
        onQueryParams,
        clearParams,
        start,
    });
}


export default API;

