import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HelloScreen } from './HelloScreen';

const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('HelloScreen', () => {
    it('renders the greeting', async () => {
        await render(
            <SafeAreaProvider initialMetrics={initialMetrics}>
                <HelloScreen name="UU" />
            </SafeAreaProvider>,
        );

        expect(screen.getByText('Hello UU')).toBeTruthy();
    });
});
