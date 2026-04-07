/**
 * A7 Flow Global API Configuration
 * ---------------------------------------
 * Replace 'YOUR_GCE_PUBLIC_IP' with the External IP from Google Compute Engine.
 */

export const GCE_PUBLIC_IP = '34.40.108.188'; // <--- ضع الـ IP هنا

export const LIVE_CONFIG = {
  CHAT_SERVER: `http://${GCE_PUBLIC_IP}:3000`,
  RTMP_PUBLISH: `rtmp://${GCE_PUBLIC_IP}:1935/live`,
  HLS_VIEW: `http://${GCE_PUBLIC_IP}:8000/live`,
};
