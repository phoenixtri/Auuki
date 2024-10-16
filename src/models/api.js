import { xf } from '../functions.js';

function API() {
    const service = 'http://localhost:8080';
    const scs = process.env.STRAVA_CLIENT_SECRET;

    // DOM
    const $registerForm = document.querySelector('#register--form');
    const $loginForm = document.querySelector('#login--form');
    const $logoutButton = document.querySelector('#logout--button');
    const $uploadWorkoutButton = document.querySelector('#upload--button');

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

    // Handlers
    async function register() {
        const url = `${service}/api/register`;
        const formData = new FormData($registerForm);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                body: JSON.stringify(Object.fromEntries(formData)),
            });

            const result = await response.json();
        } catch(error) {
            console.log(error);
        }
    }

    async function login() {
        const url = `${service}/api/login`;
        const formData = new FormData($loginForm);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify(Object.fromEntries(formData)),
            });

            const result = await response.json();
        } catch(error) {
            console.log(error);
        }
    }

    async function logout() {
        const url = `${service}/api/logout`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify({logout: true}),
            });

            const result = await response.json();
        } catch(error) {
            console.log(error);
        }
    }

    async function upload_workout(blob) {
        const url = `${service}/api/rpc`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                credentials: 'include',
                body: JSON.stringify({
                    id: crypto.randomUUID(),
                    method: 'upload_workout',
                    params: {
                        data: {
                            service: 'strava',
                            file: blob ?? new Blob()
                        }
                    },
                }),
            });

            const result = await response.json();
        } catch(error) {
            console.log(error);
        }
    }

    async function upload_workout_strava() {
    }

    async function strava_connect() {
        const url = 'https://www.strava.com/oauth/authorize';

    }

    return Object.freeze({
        upload_workout,
    });
}

export default API;

