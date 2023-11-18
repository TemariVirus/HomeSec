<script lang="ts">
    import "./styles.css";
    import { onMount } from "svelte";
    import { getAuthToken } from "$lib/auth";

    onMount(() => {
        const token = getAuthToken();
        if (token && window.location.pathname !== "/dashboard") {
            window.location.href = "/dashboard";
        }
        if (
            !token &&
            window.location.pathname !== "/" &&
            window.location.pathname !== "/register"
        ) {
            window.location.href = "/";
        }
    });
</script>

<slot />
