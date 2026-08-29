import Link from 'next/link';
import ConsumerTopNav from '../components/ConsumerTopNav';
import styles from './property-shell.module.css';

export default function PropertyLayout({ children }) {
  return <>
    <ConsumerTopNav/>
    <div className={styles.context} aria-label="VoxelPop property workflow">
      <div><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D PREVIEW</b><i>→</i><b>VOXEL</b><i>→</i><b>OPTIONAL MINT</b></div>
      <Link href="/demo">See the 3D demo</Link>
    </div>
    {children}
  </>;
}
