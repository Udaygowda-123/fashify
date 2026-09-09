import { Column, Img, Link, Row, Section, Text } from "@react-email/components";
import {
  button,
  COLOURS,
  EmailLayout,
  heading,
  muted,
  paragraph,
  rupees,
} from "./layout.js";

const CLIENT = process.env.CLIENT_ORIGIN?.split(",")[0]?.trim() ?? "http://localhost:3000";

interface LineView {
  name: string;
  size: string;
  colour: string;
  quantity: number;
  unitPrice: number;
  image?: string | null;
}

function Lines({ lines }: { lines: LineView[] }) {
  return (
    <Section style={{ margin: "8px 0 16px" }}>
      {lines.map((line, index) => (
        <Row key={`${line.name}-${line.size}-${index}`} style={{ marginBottom: "14px" }}>
          {line.image ? (
            <Column style={{ width: "64px", verticalAlign: "top" }}>
              <Img
                src={`${CLIENT}${line.image}`}
                // Real description, not the product name repeated.
                alt={`${line.name} in ${line.colour}, photographed on a plain ground`}
                width="56"
                height="75"
                style={{ display: "block" }}
              />
            </Column>
          ) : null}
          <Column style={{ verticalAlign: "top", paddingLeft: line.image ? "12px" : 0 }}>
            <Text style={{ ...paragraph, margin: "0 0 2px" }}>{line.name}</Text>
            <Text style={{ ...muted, margin: 0 }}>Size {line.size}</Text>
            <Text style={{ ...muted, margin: 0 }}>{line.colour}</Text>
            <Text style={{ ...muted, margin: 0 }}>Quantity {line.quantity}</Text>
          </Column>
          <Column style={{ textAlign: "right", verticalAlign: "top", width: "80px" }}>
            <Text style={{ ...paragraph, margin: 0 }}>
              {rupees(line.unitPrice * line.quantity)}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export interface OrderConfirmationProps {
  orderNumber: string;
  name: string;
  lines: LineView[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  address: { line1: string; city: string; state: string; pincode: string };
}

export function OrderConfirmation(props: OrderConfirmationProps) {
  return (
    <EmailLayout preview={`Order ${props.orderNumber} is confirmed`}>
      <Text style={heading}>That is on its way</Text>
      <Text style={paragraph}>
        Thank you, {props.name.split(" ")[0]}. Order {props.orderNumber} is confirmed and
        will leave us in the next two working days.
      </Text>

      <Lines lines={props.lines} />

      <Section style={{ borderTop: `1px solid ${COLOURS.rule}`, paddingTop: "14px" }}>
        <Row>
          <Column>
            <Text style={{ ...muted, margin: 0 }}>Subtotal</Text>
          </Column>
          <Column style={{ textAlign: "right" }}>
            <Text style={{ ...muted, margin: 0 }}>{rupees(props.subtotal)}</Text>
          </Column>
        </Row>
        {props.discount > 0 ? (
          <Row>
            <Column>
              <Text style={{ ...muted, margin: 0 }}>Discount</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text style={{ ...muted, margin: 0 }}>−{rupees(props.discount)}</Text>
            </Column>
          </Row>
        ) : null}
        <Row>
          <Column>
            <Text style={{ ...muted, margin: 0 }}>Delivery</Text>
          </Column>
          <Column style={{ textAlign: "right" }}>
            <Text style={{ ...muted, margin: 0 }}>
              {props.shipping === 0 ? "Free" : rupees(props.shipping)}
            </Text>
          </Column>
        </Row>
        <Row style={{ marginTop: "8px" }}>
          <Column>
            <Text style={{ ...paragraph, margin: 0 }}>Total</Text>
          </Column>
          <Column style={{ textAlign: "right" }}>
            <Text style={{ ...paragraph, margin: 0 }}>{rupees(props.total)}</Text>
          </Column>
        </Row>
      </Section>

      <Text style={{ ...muted, marginTop: "18px" }}>
        Going to {props.address.line1}, {props.address.city}, {props.address.state}{" "}
        {props.address.pincode}. GST is included in the prices shown.
      </Text>

      <Section style={{ marginTop: "20px" }}>
        <Link href={`${CLIENT}/account/orders/${props.orderNumber}`} style={button}>
          Track this order
        </Link>
      </Section>
    </EmailLayout>
  );
}

/* -------------------------------------------------------------------------- */

export interface BackInStockProps {
  productName: string;
  size: string;
  colour: string;
  slug: string;
  available: number;
  image?: string | null;
}

export function BackInStock(props: BackInStockProps) {
  return (
    <EmailLayout preview={`${props.productName} is back in ${props.size}`}>
      <Text style={heading}>Back in your size</Text>
      <Text style={paragraph}>
        The {props.productName} is in stock again in {props.size}
        {props.colour ? `, ${props.colour.toLowerCase()}` : ""}.
      </Text>
      {props.available <= 3 ? (
        <Text style={paragraph}>
          There {props.available === 1 ? "is one" : `are ${props.available}`} left, and we
          have told everyone who was waiting — so it may not last.
        </Text>
      ) : null}

      <Section style={{ marginTop: "18px" }}>
        <Link href={`${CLIENT}/shop/${props.slug}`} style={button}>
          See it
        </Link>
      </Section>

      <Text style={{ ...muted, marginTop: "18px" }}>
        You asked to hear about this one. We will not email you about it again.
      </Text>
    </EmailLayout>
  );
}

/* -------------------------------------------------------------------------- */

export interface AbandonedBagProps {
  name: string | null;
  lines: LineView[];
  total: number;
  recoveryUrl: string;
}

export function AbandonedBag(props: AbandonedBagProps) {
  return (
    <EmailLayout preview="Your bag is still here">
      <Text style={heading}>Still in your bag</Text>
      <Text style={paragraph}>
        {props.name ? `${props.name.split(" ")[0]}, you` : "You"} left these behind. They
        are not held, so if a size matters it is worth going back for it.
      </Text>

      <Lines lines={props.lines} />

      <Text style={{ ...paragraph, marginTop: "4px" }}>
        {rupees(props.total)} in total.
      </Text>

      <Section style={{ marginTop: "18px" }}>
        <Link href={props.recoveryUrl} style={button}>
          Open my bag
        </Link>
      </Section>

      <Text style={{ ...muted, marginTop: "18px" }}>
        This is the only reminder we will send about it.
      </Text>
    </EmailLayout>
  );
}

/* -------------------------------------------------------------------------- */

export interface LowStockDigestProps {
  rows: {
    productName: string;
    sku: string;
    size: string;
    colour: string;
    available: number;
    lowStockThreshold: number;
  }[];
}

export function LowStockDigest(props: LowStockDigestProps) {
  const out = props.rows.filter((row) => row.available <= 0);
  const low = props.rows.filter((row) => row.available > 0);

  return (
    <EmailLayout preview={`${props.rows.length} sizes need reordering`}>
      <Text style={heading}>Running low</Text>
      <Text style={paragraph}>
        {out.length > 0
          ? `${out.length} ${out.length === 1 ? "size is" : "sizes are"} sold out and ${low.length} ${low.length === 1 ? "is" : "are"} close.`
          : `${low.length} ${low.length === 1 ? "size is" : "sizes are"} close to selling out.`}
      </Text>

      {[
        { title: "Sold out", rows: out },
        { title: "Nearly gone", rows: low },
      ]
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <Section key={group.title} style={{ marginTop: "16px" }}>
            <Text style={{ ...paragraph, margin: "0 0 8px" }}>{group.title}</Text>
            {group.rows.map((row) => (
              <Row key={row.sku} style={{ marginBottom: "6px" }}>
                <Column>
                  <Text style={{ ...muted, margin: 0, color: COLOURS.ink }}>
                    {row.productName}
                  </Text>
                  <Text style={{ ...muted, margin: 0 }}>
                    {row.size}, {row.colour}, {row.sku}
                  </Text>
                </Column>
                <Column style={{ textAlign: "right", width: "72px" }}>
                  <Text style={{ ...muted, margin: 0 }}>
                    {row.available === 0 ? "none" : `${row.available} left`}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>
        ))}

      <Section style={{ marginTop: "20px" }}>
        <Link href={`${CLIENT}/admin/products`} style={button}>
          Open the stock list
        </Link>
      </Section>
    </EmailLayout>
  );
}
