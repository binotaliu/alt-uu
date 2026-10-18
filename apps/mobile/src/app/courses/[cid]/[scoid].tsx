import { MaterialScreen } from '@altuu/features';
import { useLocalSearchParams } from 'expo-router';

export default function MaterialRoute() {
  const { cid, scoid } = useLocalSearchParams<{
    cid: string;
    scoid: string;
  }>();

  return <MaterialScreen cid={String(cid)} scoid={String(scoid)} />;
}
