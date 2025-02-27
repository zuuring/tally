import React, { ReactElement } from "react"
import { getAccountTotal } from "@tallyho/tally-background/redux-slices/selectors"
import {
  AccountSigner,
  ReadOnlyAccountSigner,
} from "@tallyho/tally-background/services/signing"
import { SignOperationType } from "@tallyho/tally-background/redux-slices/signing"
import { useBackgroundSelector } from "../../hooks"
import SignTransactionNetworkAccountInfoTopBar from "../SignTransaction/SignTransactionNetworkAccountInfoTopBar"
import {
  ResolvedSignatureDetails,
  resolveSignatureDetails,
} from "./SigningData"
import SharedSkeletonLoader from "../Shared/SharedSkeletonLoader"
import SignTransactionLoader from "../SignTransaction/SignTransactionLoader"
import SignerFrame from "./Signer/SignerFrame"

// Signing acts as a dispatcher, so prop spreading is a good tradeoff.
// The explicit prop and component types ease the linter rule's concern around
// forwarding unintended props. Disable the rule for the rest of the file
// accordingly.
/* eslint-disable react/jsx-props-no-spreading */

type SigningLoadedProps<T extends SignOperationType> = {
  request: T
  signatureDetails: ResolvedSignatureDetails
}

// Wrapped component that is used when all signing-related data is known to be
// loaded.
function SigningLoaded<T extends SignOperationType>({
  request,
  signatureDetails,
}: SigningLoadedProps<T>): ReactElement {
  const { signingAddress, renderedSigningData } = signatureDetails

  const signerAccountTotal = useBackgroundSelector((state) => {
    return getAccountTotal(state, signingAddress)
  })

  return (
    <section>
      <SharedSkeletonLoader
        isLoaded={signerAccountTotal !== undefined}
        height={32}
        width={120}
        customStyles="margin: 15px 0 15px 220px;"
      >
        {signerAccountTotal !== undefined && (
          <SignTransactionNetworkAccountInfoTopBar
            accountTotal={signerAccountTotal}
          />
        )}
      </SharedSkeletonLoader>
      <SignerFrame request={request} {...signatureDetails}>
        {renderedSigningData}
      </SignerFrame>
      <style jsx>
        {`
          section {
            width: 100%;
            height: calc(100% - 80px);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            background-color: var(--green-95);
            z-index: 5;
          }
          section :global(.title) {
            color: var(--trophy-gold);
            font-size: 36px;
            font-weight: 500;
            line-height: 42px;
            text-align: center;
          }
          section :global(footer) {
            position: fixed;
            bottom: 0px;
            display: flex;
            width: 100%;
            padding: 0px 16px;
            box-sizing: border-box;
            align-items: center;
            height: 80px;
            justify-content: space-between;
            box-shadow: 0 0 5px rgba(0, 20, 19, 0.5);
            background-color: var(--green-95);
          }
        `}
      </style>
    </section>
  )
}

type SigningProps<T extends SignOperationType> = {
  request: T | undefined
  accountSigner: AccountSigner | undefined
}

/**
 * The Signing component is an umbrella component that renders all
 * signing-related UI. It handles choosing the correct UI to present the data
 * being signed to the user, as well as the correct UI for the signer executing
 * the actual signature, and delegates control of the UI to the signer.
 */
export default function Signing<T extends SignOperationType>({
  request,
  accountSigner,
}: SigningProps<T>): ReactElement {
  if (request === undefined) {
    // FIXME Move to SigningLoader when removing feature flag.
    return <SignTransactionLoader />
  }

  const signatureDetails = resolveSignatureDetails({
    request,
    // FIXME Move defaulting to selectCurrentAccountSigner when removing feature
    // FIXME flag.
    accountSigner: accountSigner ?? ReadOnlyAccountSigner,
  })

  return <SigningLoaded request={request} signatureDetails={signatureDetails} />
}
