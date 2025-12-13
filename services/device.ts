
/**
 * Device Fingerprinting Service
 * Generates a unique hash based on the user's browser/device characteristics.
 * This is used to lock a paid token to a single device.
 */

export const getDeviceFingerprint = async (): Promise<string> => {
    // Handle screen rotation: always use max for width and min for height in signature
    // This prevents the fingerprint from changing when a mobile device is rotated.
    const width = Math.max(window.screen.width, window.screen.height);
    const height = Math.min(window.screen.width, window.screen.height);

    // Safe retriever for components to avoid crashes
    const safe = (fn: () => any) => {
        try { return fn(); } catch(e) { return 'err'; }
    };

    const components = [
        navigator.userAgent || 'ua-unknown', // Browser User Agent
        navigator.language || 'lang-unknown',  // Language
        navigator.platform || 'plat-unknown',  // Operating System Platform
        `${width}x${height}`, // Screen Resolution (Rotation safe)
        window.screen.colorDepth || 24, // Color Depth
        navigator.hardwareConcurrency || 'cpu-unknown', // CPU Cores
        (navigator as any).deviceMemory || 'mem-unknown', // RAM (approximate in GB)
        navigator.maxTouchPoints || 0, // Touch capabilities
        // Canvas Fingerprinting (Draws a hidden image and hashes the pixel data)
        safe(getCanvasFingerprint),
        // WebGL Fingerprinting (GPU Vendor/Renderer)
        safe(getWebGLFingerprint)
    ];

    const rawString = components.join('||');
    return await sha256(rawString);
};

const getCanvasFingerprint = (): string => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'no-canvas';
        
        canvas.width = 200;
        canvas.height = 50;
        
        // Simplified drawing to improve cross-browser consistency while maintaining uniqueness
        ctx.textBaseline = "alphabetic";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        
        ctx.fillStyle = "#069";
        ctx.fillText("ACE-AUTH", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("LOCK", 4, 17);
        
        return canvas.toDataURL();
    } catch (e) {
        return 'canvas-error';
    }
};

const getWebGLFingerprint = (): string => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'no-webgl';
        
        // Cast to any to access WebGLRenderingContext without strict type issues in all envs
        const context = gl as WebGLRenderingContext;
        
        const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const vendor = context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            return `${vendor}~${renderer}`;
        }
        return 'webgl-no-debug-info';
    } catch (e) {
        return 'webgl-error';
    }
};

const sha256 = async (message: string) => {
    // Use modern Crypto API if available and in secure context
    try {
        if (window.crypto && window.crypto.subtle) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        }
    } catch (e) {
        console.warn("Crypto API failed, falling back to legacy hash.");
    }

    // Fallback: FNV-1a Hash (Better collision resistance than simple shift)
    let hash = 0x811c9dc5;
    for (let i = 0; i < message.length; i++) {
        hash ^= message.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return "legacy-" + (hash >>> 0).toString(16);
};
