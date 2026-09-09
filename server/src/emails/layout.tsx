import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type * as React from "react";

/**
 * The label's voice in an inbox: stone ground, bottle-green rules, and no
 * decoration. Colours are the same tokens the storefront uses, spelled out
 * because email clients have no CSS variables.
 */
export const COLOURS = {
  stone: "#E6E7E2",
  bottle: "#16261E",
  ink: "#14201A",
  mist: "#5A625B",
  rule: "#C9CBC4",
  brass: "#A87C32",
} as const;

const body = {
  backgroundColor: COLOURS.stone,
  // Georgia for the display line, a grotesque for everything else — the
  // nearest an email client gets to Bodoni Moda and Archivo without asking it
  // to load a font it will ignore.
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: COLOURS.ink,
  margin: 0,
  padding: "32px 0",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "0 24px",
};

export const heading = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "26px",
  lineHeight: "1.15",
  letterSpacing: "-0.01em",
  color: COLOURS.ink,
  margin: "0 0 16px",
};

export const paragraph = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: COLOURS.ink,
  margin: "0 0 14px",
};

export const muted = {
  fontSize: "13px",
  lineHeight: "1.5",
  color: COLOURS.mist,
  margin: "0 0 10px",
};

export const button = {
  display: "inline-block",
  backgroundColor: COLOURS.bottle,
  color: COLOURS.stone,
  fontSize: "14px",
  textDecoration: "none",
  padding: "14px 24px",
  // No radius anywhere in this label, email included.
  borderRadius: "0",
};

export const rule = {
  borderColor: COLOURS.rule,
  borderWidth: "1px 0 0",
  margin: "24px 0",
};

export function EmailLayout({
  preview,
  children,
}: {
  /** The line shown in the inbox next to the subject. */
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "20px",
              color: COLOURS.ink,
              margin: "0 0 28px",
            }}
          >
            Fashify
          </Text>

          {children}

          <Hr style={rule} />
          <Section>
            <Text style={{ ...muted, margin: "0 0 6px" }}>
              Fashify Clothing Private Limited, Bengaluru
            </Text>
            <Text style={{ ...muted, margin: 0 }}>
              <Link href="https://fashify.example.in/shop" style={{ color: COLOURS.mist }}>
                Shop
              </Link>
              {"   "}
              <Link href="https://fashify.example.in" style={{ color: COLOURS.mist }}>
                Delivery and returns
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** ₹4,800 from 480000 paise. */
export function rupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}
