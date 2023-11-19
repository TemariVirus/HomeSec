<div class="absolute-center">
    <div class="loading-spinner" />
    <h1>Loading...</h1>
</div>

<style>
    h1 {
        font-size: 84px;
        text-align: center;
    }

    .absolute-center {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    .loading-spinner {
        border: 28px solid #f3f3f3;
        border-top: 28px solid #3498db;
        border-radius: 50%;
        width: 120px;
        height: 120px;
        animation: spin 1s linear infinite;
        margin: 2rem auto;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
