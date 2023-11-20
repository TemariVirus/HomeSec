export type CameraDevice = {
    id: string;
    name: string;
    battery: number;
    type: "camera";
    streamUrl: string;
};
export type ContactShockDevice = {
    id: string;
    name: string;
    battery: number;
    type: "contact" | "shock";
    isOpen: boolean;
};
export type Device = CameraDevice | ContactShockDevice;
