<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import deleteIcon from "$lib/images/delete.webp";
    import type { Device } from "$lib/types";

    const dispatch = createEventDispatcher();

    export let item: Device;
    export let index: number;
    export let irresponsive: boolean;
</script>

<div>
    <p>{item.deviceId} {item.name}</p>
    {#if irresponsive}
        <p>Device irresponsive</p>
    {:else}
        <p>{item.battery}% battery</p>
    {/if}
    <button class="delete-btn" on:click={() => dispatch("click", index)}>
        <img src={deleteIcon} alt="Delete" />
    </button>
</div>

<style>
    .delete-btn {
        width: 30px;
        height: 30px;
        background: none;
        border: none;
        padding: 0;
        margin: 0;
    }
</style>
