<script lang="ts">
    import About from "$lib/components/About.svelte";
    import { setAuthToken } from "$lib/auth";
    import { PUBLIC_USER_API } from "$env/static/public";
    import { goto } from "$app/navigation";

    let username = "";
    let password = "";

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
                Have an account? <a href="/">Log in</a>
            </p>
            <br />
            <button class="rounded-full" type="submit">Register</button>
        </form>
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
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: row;
        height: 100vh;
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
