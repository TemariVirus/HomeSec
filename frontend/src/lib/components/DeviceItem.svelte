<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import deleteIcon from "$lib/images/delete.webp";
    import type { Device } from "$lib/types";

    const dispatch = createEventDispatcher();

    export let item: Device;
    export let index: number;
    export let irresponsive: boolean;
</script>

<section
    style="{irresponsive || item.battery < 5
        ? 'background-color: firebrick'
        : ''};"
>
    <b>{item.name} ({item.type})</b>
    {#if irresponsive}
        <p>Device irresponsive</p>
    {:else}
        {#if item.type === "camera"}
            <p>Live feed: <a href={item.streamUrl}>{item.streamUrl}</a></p>
        {:else if item.type === "contact"}
            <p>Open: {item.isOpen ? "Yes" : "No"}</p>
        {:else if item.type === "shock"}
            <p>Open: {item.isOpen ? "Yes" : "No"}</p>
        {/if}
        <p>{Math.round(item.battery * 10) / 10}% battery</p>
    {/if}
    <button class="delete-btn" on:click={() => dispatch("click", index)}>
        <img src={deleteIcon} alt="Delete" />
    </button>
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 1rem;
        margin: 1rem;
    }

    p {
        margin: 0.5rem 0;
    }

    b {
        margin: 0.5rem 0;
        font-size: x-large;
    }

    .delete-btn {
        width: 25px;
        height: 25px;
        background: none;
        border: none;
        padding: 0;
        margin: 0.5rem;
        margin-top: 1rem;
        align-self: flex-end;
    }
</style>
