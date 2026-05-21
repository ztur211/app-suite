import { render } from '@testing-library/react-native';
import { Heading } from '../primitives/Heading/Heading';
import { tokens } from '../tokens';

describe('Heading', () => {
  it('renders children as text', () => {
    const { getByText } = render(<Heading level={1}>Do Things</Heading>);
    expect(getByText('Do Things')).toBeTruthy();
  });

  it('level 1 uses the largest font size', () => {
    const { getByText } = render(<Heading level={1}>H1</Heading>);
    const style = getByText('H1').props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.fontSize).toBe(tokens.typography.fontSize['4xl']);
  });

  it('level 2 uses 3xl font size', () => {
    const { getByText } = render(<Heading level={2}>H2</Heading>);
    const style = getByText('H2').props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.fontSize).toBe(tokens.typography.fontSize['3xl']);
  });

  it('level 3 uses 2xl font size', () => {
    const { getByText } = render(<Heading level={3}>H3</Heading>);
    const style = getByText('H3').props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.fontSize).toBe(tokens.typography.fontSize['2xl']);
  });

  it('level 4 uses xl font size', () => {
    const { getByText } = render(<Heading level={4}>H4</Heading>);
    const style = getByText('H4').props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.fontSize).toBe(tokens.typography.fontSize.xl);
  });

  it('accepts optional testID', () => {
    const { getByTestId } = render(
      <Heading level={1} testID="heading-el">
        Title
      </Heading>,
    );
    expect(getByTestId('heading-el')).toBeTruthy();
  });
});
