<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte";
    import exit from "$lib/images/exit.svg";

    const dispatch = createEventDispatcher();
    const close = () => {
        show = false;
        dispatch("close");
    };

    let modal: HTMLElement;
    export let show: boolean;
    export let bg: string = "gray";

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            close();
            return;
        }

        // trap focus
        if (e.key === "Tab") {
            const nodes = modal.querySelectorAll("*");
            const tabbable = Array.from(nodes).filter(
                (n) => (n as HTMLElement).tabIndex >= 0
            );

            let index = tabbable.indexOf(document.activeElement!);
            if (index === -1 && e.shiftKey) index = 0;

            index += tabbable.length + (e.shiftKey ? -1 : 1);
            index %= tabbable.length;

            (tabbable[index] as HTMLElement).focus();
            e.preventDefault();
        }
    };

    const previously_focused =
        typeof document !== "undefined" && document.activeElement;

    if (previously_focused) {
        onDestroy(() => {
            (previously_focused as HTMLElement).focus();
        });
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
    <div
        class="modal-background"
        role="button"
        tabindex="0"
        on:keydown={null}
        on:click={close}
    />

    <div
        class="modal"
        role="dialog"
        aria-modal="true"
        style="background: {bg};"
        bind:this={modal}
    >
        <button class="cancel-btn" on:click={close}>
            <img
                style="width: 2.5rem; height: 2.5rem"
                src={exit}
                alt="cancel"
                width="54"
                height="54"
            />
        </button>
        <slot />
    </div>
{/if}

<style>
    .modal-background {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        z-index: 100;
    }

    .modal {
        position: absolute;
        left: 50%;
        top: 50%;
        width: calc(100vw - 4em);
        max-width: 32em;
        max-height: calc(100vh - 4em);
        overflow: auto;
        transform: translate(-50%, -50%);
        padding: 1em;
        border-radius: 0.2em;
        z-index: 101;
    }

    .cancel-btn {
        position: absolute;
        top: 0;
        right: 0;
        border: 0;
        background: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        width: 2.5rem;
        height: 2.5rem;
    }
</style>
