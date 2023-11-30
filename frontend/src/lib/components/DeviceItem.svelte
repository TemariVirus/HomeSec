<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import deleteIcon from "$lib/images/delete.webp";
    import type { Device } from "$lib/types";

    const LOW_BATTERY_THRESHOLD = 5;
    const dispatch = createEventDispatcher();

    export let item: Device;
    export let index: number;
    export let irresponsive: boolean;
</script>

<section
    style={irresponsive || item.battery < LOW_BATTERY_THRESHOLD
        ? "background-color: firebrick;"
        : ""}
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
        <p
            style={item.battery < LOW_BATTERY_THRESHOLD
                ? "font-weight: 800;"
                : ""}
        >
            {Math.round(item.battery * 10) / 10}% battery
        </p>
    {/if}
    <div class="bottom">
        {#if item.type === "camera"}
            <button on:click={() => dispatch("open-clips", index)}>Clips</button
            >
        {/if}
        <button class="delete-btn" on:click={() => dispatch("click", index)}>
            <img src={deleteIcon} alt="Delete" />
        </button>
    </div>
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

    button {
        border-radius: 100vw;
        border: 1px solid #ccc;
        padding: 0.5rem 0.75rem;
        margin: auto 0.5rem;
    }

    button:hover {
        background-color: #ccc;
    }

    .bottom {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        width: 100%;
        margin-top: 1rem;
    }

    .delete-btn {
        width: 25px;
        height: 25px;
        background: none;
        border: none;
        padding: 0;
        margin: 0.5rem;
        margin-left: auto;
    }

    .delete-btn:hover {
        background: none;
    }
</style>
