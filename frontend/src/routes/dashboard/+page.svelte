<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { websocket as Websocket } from "@sveu/browser";

    import { goto } from "$app/navigation";
    import DeviceItem from "$lib/components/DeviceItem.svelte";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import Modal from "$lib/components/Modal.svelte";
    import SortableList from "$lib/components/SortableList.svelte";

    import { getAuthToken, clearAuthToken } from "$lib/auth";
    import type { Device } from "$lib/types";
    import { PUBLIC_USER_API, PUBLIC_WEBSOCKET_API } from "$env/static/public";

    let isAddingDevice = false;
    let addDeviceId = "";
    let addDeviceName = "";
    let addDeviceRefreshInterval: ReturnType<typeof setInterval>;
    let showAddModal = false;

    let initialised = false;
    let username = "";
    let devices = [] as Device[];
    let isArmed = false;

    let ws: ReturnType<typeof Websocket>;
    let websocket: WebSocket;
    onMount(() => {
        const temp = connect();
        if (!temp) {
            clearAuthToken();
            goto("/");
            return;
        }

        ws = temp;
        websocket = get(ws.ws)!;
        ws.data.subscribe(handleData);
    });

    function connect(): ReturnType<typeof Websocket> | undefined {
        const token = getAuthToken();

        if (!token) {
            clearAuthToken();
            return;
        }

        return Websocket(`${PUBLIC_WEBSOCKET_API}?token=${token}`, {
            onConnected: (socket) => {
                getInfo(socket);
            },
            onError: (_) => {
                clearAuthToken();
                goto("/");
            },
        });
    }

    function handleData(msg: any) {
        console.log("Received message from websocket:", msg);

        let json;
        try {
            json = JSON.parse(msg) ?? {};
        } catch {
            return;
        }

        const { action, data } = json;
        if (!action || !data) {
            return;
        }

        switch (action) {
            case "get-info":
                initialised = true;
                username = data.username;
                devices = sortDevices(data.devices);
                saveDeviceOrder();
                isArmed = data.isArmed;

                if (addDeviceId !== "") {
                    const added = devices.some((d) => d.id === addDeviceId);
                    if (added) {
                        addDeviceId = "";
                        addDeviceName = "";
                        clearInterval(addDeviceRefreshInterval);
                        showAddModal = false;
                    }
                }
                break;
            case "add-device":
                addDeviceId = data;
                isAddingDevice = false;
                addDeviceRefreshInterval = setInterval(
                    () => getInfo(websocket),
                    1500
                );
                break;
        }
    }

    function getInfo(socket: WebSocket) {
        socket.send(JSON.stringify({ action: "get-info" }));
    }

    function addDevice(socket: WebSocket, name: string) {
        if (isAddingDevice) {
            return;
        }

        isAddingDevice = true;
        addDeviceId = "";
        socket.send(JSON.stringify({ action: "add-device", data: name }));
    }

    function cancelAdd() {
        if (addDeviceId == "") {
            return;
        }

        ws?.send(
            JSON.stringify({ action: "cancel-add-device", data: addDeviceId })
        );
        isAddingDevice = false;
        addDeviceId = "";
    }

    function sortDevices(devices: Device[]): Device[] {
        const savedDevices = localStorage.getItem("deviceOrder")?.split(",");
        if (!savedDevices) {
            return devices;
        }

        // Sort the devices according to the previously saved order
        let newDevices = [] as Device[];
        for (const id of savedDevices) {
            const index = devices.findIndex((d) => d.id === id);
            if (index === -1) continue;

            newDevices.push(devices[index]);
            devices.splice(index, 1);
        }
        // Append any remaining devices to the end
        newDevices.push(...devices);

        return newDevices;
    }

    function saveDeviceOrder() {
        localStorage.setItem("deviceOrder", devices.map((d) => d.id).join(","));
    }

    function handleSort(e: CustomEvent<Device[]>) {
        devices = e.detail;
        saveDeviceOrder();
    }

    function handleRemove(e: CustomEvent<number>) {
        const index = e.detail;
        const id = devices[index].id;
        devices.splice(index, 1);
        devices = devices; // Needed to trigger reactivity
        saveDeviceOrder();
        ws?.send(JSON.stringify({ action: "remove-device", data: id }));
    }

    function logout() {
        const token = getAuthToken();
        clearAuthToken();
        ws?.close();

        fetch(`${PUBLIC_USER_API}/login`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.text())
            .catch((res) => {
                console.error("Failed to logout:", res);
            })
            .finally(() => {
                goto("/");
            });
    }
</script>

{#if !initialised}
    <LoadingSpinner />
{:else}
    <Modal bind:show={showAddModal} bg="#222" on:close={cancelAdd}>
        {#if isAddingDevice}
            <div class="spinner-container">
                <LoadingSpinner />
            </div>
        {:else if addDeviceId !== ""}
            <div class="id-container">
                <p>Enter this ID into your device</p>
                <h1>{addDeviceId}</h1>
                <p>Please do not close this modal</p>
            </div>
        {:else}
            <form
                on:submit|preventDefault={() =>
                    addDevice(websocket, addDeviceName)}
            >
                <label for="name">Name your device</label>
                <input
                    name="name"
                    type="text"
                    placeholder="Name"
                    bind:value={addDeviceName}
                />
                <button type="submit">Add</button>
            </form>
        {/if}
    </Modal>

    <div class="dashboard">
        <h1>Hello, {username}!</h1>
        <SortableList
            list={devices}
            key="id"
            on:sort={handleSort}
            let:item
            let:index
        >
            <DeviceItem {item} {index} on:click={handleRemove} />
        </SortableList>
        <div>
            <button on:click={() => (showAddModal = true)}>Add device</button>
            <button on:click={logout}>Logout</button>
        </div>
    </div>
{/if}

<style>
    form {
        display: flex;
        flex-direction: column;
        align-self: center;
        margin: 3rem;
        margin-top: 5rem;
    }

    input[type="text"] {
        padding: 0.5rem;
        border-radius: 100vw;
        margin-top: 0.5rem;
        margin-bottom: 2rem;
        border: 1px solid #ccc;
    }

    button {
        padding: 0.5rem;
        border-radius: 100vw;
        margin-top: 0.5rem;
        margin-bottom: 2rem;
        border: 1px solid #ccc;
    }

    .dashboard {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 2rem;
    }

    .spinner-container {
        height: 450px;
        width: 500px;
    }

    .id-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 3rem;
    }

    .id-container p {
        margin-bottom: 1rem;
        font-size: 28px;
    }

    .id-container h1 {
        margin-top: 0;
        font-size: 56px;
    }
</style>
