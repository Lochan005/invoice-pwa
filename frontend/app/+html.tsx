// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body { background-color: #f3f4f6; }
              body > div:first-child { 
                position: fixed !important; 
                top: 0; 
                bottom: 0; 
                left: 50% !important; 
                transform: translateX(-50%);
                width: 100% !important;
                max-width: 600px !important;
                background-color: #ffffff;
                box-shadow: 0 0 20px rgba(0,0,0,0.05); /* Soft shadow for desktop container */
              }
              /* ensure inner roots can respond properly */
              #root { height: 100%; display: flex; flex-direction: column; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            if (!('serviceWorker' in navigator)) return;
            var MIGRATION_KEY = 'invoice-sw-cache-v2';
            window.addEventListener('load', function() {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                if (registrations.length > 0 && !localStorage.getItem(MIGRATION_KEY)) {
                  return Promise.all(
                    registrations.map(function(r) { return r.unregister(); })
                  ).then(function() {
                    try { localStorage.setItem(MIGRATION_KEY, '1'); } catch (e) {}
                    window.location.reload();
                  });
                }
                try {
                  if (!localStorage.getItem(MIGRATION_KEY)) localStorage.setItem(MIGRATION_KEY, '1');
                } catch (e) {}
                return navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
                  console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }).catch(function(err) {
                  console.log('ServiceWorker registration failed: ', err);
                });
              });
            });
          })();
        `}} />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
