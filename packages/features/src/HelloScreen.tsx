import { Screen, Text } from '@altuu/ui';

export interface HelloScreenProps {
    name?: string;
}

export function HelloScreen({ name = 'Alt UU' }: HelloScreenProps) {
    return (
        <Screen>
            <Text>{`Hello ${name}`}</Text>
        </Screen>
    );
}
