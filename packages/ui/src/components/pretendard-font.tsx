// Load once from each app's root layout so public pages and portal UI share it.
export function PretendardFont() {
  return (
    <>
      <link
        rel="preconnect"
        href="https://cdn.jsdelivr.net"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        crossOrigin="anonymous"
        precedence="default"
      />
    </>
  );
}
