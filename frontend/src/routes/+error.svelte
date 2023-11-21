<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { getAuthToken, logout } from "$lib/auth";

    import Error from "$lib/components/Error.svelte";
    import { onMount } from "svelte";

    onMount(() => {
        switch ($page.status) {
            case 401:
                logout();
                break;
            case 404:
                if (getAuthToken()) {
                    goto("/dashboard");
                } else {
                    goto("/");
                }
                break;
        }
    });
</script>

<Error status={$page.status} message={$page.error?.message ?? ""} />
