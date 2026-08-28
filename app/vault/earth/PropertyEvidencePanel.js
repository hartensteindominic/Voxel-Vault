'use client';

function clean(value) { return String(value || '').trim(); }

function addressFor({ listing, building, fallbackLabel }) {
  const listingAddress = [listing?.address, listing?.city, listing?.region, listing?.postalCode, listing?.country].filter(Boolean).join(', ');
  const mappedAddress = [building?.tags?.houseNumber, building?.tags?.street].filter(Boolean).join(' ');
  return listingAddress || mappedAddress || clean(fallbackLabel) || 'Selected property';
}

function sourceLinks(address, latitude, longitude) {
  const point = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const query = point ? `${Number(latitude)},${Number(longitude)}` : address;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const streetView = point
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${Number(latitude)},${Number(longitude)}`)}`
    : maps;
  const zillow = `https://www.zillow.com/homes/${encodeURIComponent(address)}_rb/`;
  const redfinSearch = `https://www.google.com/search?q=${encodeURIComponent(`site:redfin.com ${address}`)}`;
  const realtorSearch = `https://www.google.com/search?q=${encodeURIComponent(`site:realtor.com ${address}`)}`;
  return { maps, streetView, zillow, redfinSearch, realtorSearch };
}

export default function PropertyEvidencePanel({ listing = null, building = null, fallbackLabel = '' }) {
  const latitude = Number.isFinite(Number(listing?.latitude)) ? Number(listing.latitude) : Number(building?.latitude);
  const longitude = Number.isFinite(Number(listing?.longitude)) ? Number(listing.longitude) : Number(building?.longitude);
  const address = addressFor({ listing, building, fallbackLabel });
  const links = sourceLinks(address, latitude, longitude);
  const listingImage = listing?.imageUrl || null;

  return <section className="evidencePanel">
    <div className="evidenceHead">
      <div><small>VISUAL EVIDENCE</small><h3>Cross-check the real place.</h3></div>
      <span>{listingImage ? 'AUTHORIZED LISTING MEDIA AVAILABLE' : 'MAP REFERENCES AVAILABLE'}</span>
    </div>

    {listingImage ? <div className="listingEvidence">
      <img src={listingImage} alt={`Authorized listing reference for ${address}`} referrerPolicy="no-referrer" />
      <div><b>{listing?.provider || 'Authorized listing provider'}</b><span>This image is displayed as listing evidence from the connected provider. Display permission does not automatically mean AI-derivative rights.</span>{listing?.sourceUrl ? <a href={listing.sourceUrl} target="_blank" rel="noreferrer">OPEN ORIGINAL LISTING ↗</a> : null}</div>
    </div> : null}

    <div className="referenceGrid">
      <a href={links.maps} target="_blank" rel="noreferrer"><b>GOOGLE MAPS</b><span>Location + imagery ↗</span></a>
      <a href={links.streetView} target="_blank" rel="noreferrer"><b>STREET VIEW</b><span>Ground-level reference ↗</span></a>
      <a href={links.zillow} target="_blank" rel="noreferrer"><b>ZILLOW</b><span>Look for listing photos ↗</span></a>
      <a href={links.redfinSearch} target="_blank" rel="noreferrer"><b>REDFIN</b><span>Find matching listing ↗</span></a>
      <a href={links.realtorSearch} target="_blank" rel="noreferrer"><b>REALTOR.COM</b><span>Find matching listing ↗</span></a>
    </div>

    <p className="evidenceTruth"><b>Why these are separate:</b> Google/Zillow/Redfin imagery can be valuable visual evidence, but their pixels are not automatically licensed training/reconstruction inputs. Voxel Vault may display or link to them only in permitted ways. Meshy receives user-owned, open-licensed, or explicitly derivative-licensed images.</p>
    <style jsx>{styles}</style>
  </section>;
}

const styles = `
.evidencePanel{display:grid;gap:13px;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(255,255,255,.018)}.evidenceHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.evidenceHead small{font-size:7px;letter-spacing:.14em;color:#7ddfba;font-weight:950}.evidenceHead h3{font-size:20px;letter-spacing:-.035em;margin:4px 0 0}.evidenceHead>span{font-size:6px;letter-spacing:.1em;font-weight:900;color:#9ba7a2;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:7px 9px}.listingEvidence{display:grid;grid-template-columns:minmax(110px,180px) 1fr;gap:12px;padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(0,0,0,.17)}.listingEvidence img{width:100%;height:120px;object-fit:cover;border-radius:12px;background:#101817}.listingEvidence>div{display:grid;align-content:center;gap:5px}.listingEvidence b{font-size:9px}.listingEvidence span,.listingEvidence a{font-size:8px;line-height:1.5;color:#87938e}.listingEvidence a{color:#d8f8eb;text-decoration:none;font-weight:850}.referenceGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.referenceGrid a{display:grid;gap:4px;padding:11px;border-radius:14px;border:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.13);text-decoration:none;color:#eef8f4}.referenceGrid b{font-size:7px;letter-spacing:.1em}.referenceGrid span{font-size:7px;color:#7e8a85}.evidenceTruth{margin:0;color:#77837e;font-size:8px;line-height:1.6}.evidenceTruth b{color:#aab7b1}
@media(max-width:760px){.evidenceHead{display:grid}.evidenceHead>span{justify-self:start}.referenceGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.listingEvidence{grid-template-columns:1fr}.listingEvidence img{height:170px}}
`;
