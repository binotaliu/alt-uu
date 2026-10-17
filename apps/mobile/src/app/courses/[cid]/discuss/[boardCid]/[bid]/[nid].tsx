import { DiscussThreadScreen } from '@altuu/features';
import { useLocalSearchParams } from 'expo-router';

export default function DiscussThreadRoute() {
    const { cid, boardCid, bid, nid } = useLocalSearchParams<{
        cid: string;
        boardCid: string;
        bid: string;
        nid: string;
    }>();

    return (
        <DiscussThreadScreen
            cid={cid}
            boardCid={boardCid}
            bid={bid}
            nid={nid}
        />
    );
}
