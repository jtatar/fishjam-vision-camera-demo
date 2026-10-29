import { act } from '@testing-library/react-native';
import { runOnUIAsync } from 'react-native-worklets';

export async function flushUI() {
  await act(async () => {
    await runOnUIAsync(() => undefined);
  });
}
