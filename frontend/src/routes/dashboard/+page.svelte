<script lang="ts">
    import { onMount } from "svelte";
    import { websocket } from "@sveu/browser";
    import { getAuthToken, clearAuthToken } from "$lib/auth";
    import { PUBLIC_WEBSOCKET_API } from "$env/static/public";

    let ws: ReturnType<typeof websocket> | undefined;
    onMount(() => {
        ws = connect();

        if (!ws) {
            clearAuthToken();
            window.location.href = "/";
        }

        ws!.data.subscribe(handleData);
    });

    function connect(): ReturnType<typeof websocket> | undefined {
        const token = getAuthToken();

        if (!token) {
            clearAuthToken();
            return;
        }

        return websocket(`${PUBLIC_WEBSOCKET_API}?token=${token}`, {
            onError: () => {
                clearAuthToken();
                window.location.href = "/";
            },
        });
    }

    function handleData(data: any) {
        console.log(data);
    }

    function logout() {
        clearAuthToken();
        ws?.close();
        window.location.href = "/";
    }
</script>

<h1>TODO</h1>
<button on:click={logout}>Logout</button>

<style>
</style>
