import { Heading, Button, Card, ThemeProvider, tokens } from '@things/design-system';
import { View } from 'react-native';

export default function Index() {
  return (
    <ThemeProvider accent={tokens.colors.apps.do}>
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}
      >
        <Heading level={1}>Do Things</Heading>
        <Card>
          <Heading level={3}>Today</Heading>
          <Button label="Add task" onPress={() => {}} variant="primary" />
        </Card>
      </View>
    </ThemeProvider>
  );
}
