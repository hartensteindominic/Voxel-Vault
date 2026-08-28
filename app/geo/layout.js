export default function GeoLayout({ children }) {
  return <>
    {children}
    <footer style={{ background: '#050807', color: '#8ea099', textAlign: 'center', padding: '0 18px 28px', fontSize: 11, lineHeight: 1.5 }}>
      Global reference geometry/geocoding may use © OpenStreetMap contributors under ODbL.{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: '#7ce9c4' }}>Attribution & license</a>.
      Public OSM services are configured for small-scale, user-triggered lookups; production scale should use configured/self-hosted or commercial providers.
    </footer>
  </>;
}
