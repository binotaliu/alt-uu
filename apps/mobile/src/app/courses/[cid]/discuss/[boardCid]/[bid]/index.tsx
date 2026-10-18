import { DiscussBoardScreen } from '@altuu/features';
import { useLocalSearchParams } from 'expo-router';

export default function DiscussBoardRoute() {
  const { cid, boardCid, bid } = useLocalSearchParams<{
    cid: string;
    boardCid: string;
    bid: string;
  }>();

  return <DiscussBoardScreen cid={cid} boardCid={boardCid} bid={bid} />;
}
