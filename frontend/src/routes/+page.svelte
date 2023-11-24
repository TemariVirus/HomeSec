<script lang="ts">
    import { goto } from "$app/navigation";
    import About from "$lib/components/About.svelte";
    import { getAuthToken, setAuthToken } from "$lib/auth";
    import { PUBLIC_USER_API } from "$env/static/public";

    let username = "";
    let password = "";
    let login = true;

    if (getAuthToken()) {
        goto("/dashboard");
    }

    function handleLogin(): void {
        fetch(`${PUBLIC_USER_API}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: username,
                password: password,
            }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(await res.text());
                }
                return res.text();
            })
            .then((res) => {
                setAuthToken(res);
                goto("/dashboard");
            })
            .catch((err) => alert(err));
    }

    function handleRegister(): void {
        fetch(PUBLIC_USER_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: username,
                password: password,
            }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(await res.text());
                }
            })
            .then(() =>
                fetch(`${PUBLIC_USER_API}/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                    }),
                })
            )
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(await res.text());
                }
                return res.text();
            })
            .then((res) => {
                setAuthToken(res);
                goto("/dashboard");
            })
            .catch((err) => alert(err));
    }
</script>

<div class="container">
    <div class="left">
        <About />
    </div>
    <div class="right">
        {#if login}
            <h1>Log in</h1>
            <form on:submit|preventDefault={handleLogin}>
                <label for="username">Username</label>
                <input
                    bind:value={username}
                    class="rounded-full"
                    name="username"
                    type="username"
                    placeholder="Username"
                />
                <br />
                <label for="password">Password</label>
                <input
                    bind:value={password}
                    class="rounded-full"
                    name="password"
                    type="password"
                    placeholder="Password"
                />
                <p class="small-text redirect-text">
                    No account? <a on:click={() => (login = false)}>Register</a>
                </p>
                <br />
                <button class="rounded-full" type="submit">Log in</button>
            </form>
        {:else}
            <h1>Register</h1>
            <form on:submit|preventDefault={handleRegister}>
                <label for="username">Username</label>
                <input
                    bind:value={username}
                    class="rounded-full"
                    name="username"
                    type="username"
                    placeholder="Username"
                />
                <br />
                <label for="password">Password</label>
                <input
                    bind:value={password}
                    class="rounded-full"
                    name="password"
                    type="password"
                    placeholder="Password"
                />
                <p class="small-text redirect-text">
                    Have an account? <a on:click={() => (login = true)}>
                        Log in
                    </a>
                </p>
                <br />
                <button class="rounded-full" type="submit">Register</button>
            </form>
        {/if}
    </div>
</div>

<style>
    h1 {
        font-size: 4rem;
        margin-bottom: 1.5rem;
    }

    form {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    label {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
        align-self: flex-start;
    }

    input[type="username"],
    input[type="password"] {
        width: 100%;
        font-size: 1.5rem;
        padding: 0.5rem 0.75rem;
        color: black;
        background-color: #fff;
        border: 0px;
    }

    button {
        font-size: 20px;
        width: 70%;
    }

    .container {
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: row;
        top: 0;
        left: 0;
        height: 100vh;
        width: 100vw;
    }

    .left,
    .right {
        width: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
    }

    .left {
        margin-left: 10%;
    }

    .right {
        margin-right: 10%;
    }

    .redirect-text {
        align-self: flex-start;
        margin: 0.7rem 0rem;
    }
</style>
