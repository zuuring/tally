import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { formatUnits } from "@ethersproject/units"
import {
  broadcastSignedTransaction,
  selectEstimatedFeesPerGas,
  selectIsTransactionLoaded,
  selectIsTransactionSigned,
  selectTransactionData,
  signTransaction,
  updateTransactionOptions,
} from "@tallyho/tally-background/redux-slices/transaction-construction"
import { BlockEstimate } from "@tallyho/tally-background/networks"
import SharedButton from "../components/Shared/SharedButton"
import SharedPanelSwitcher from "../components/Shared/SharedPanelSwitcher"
import SignTransactionSwapAssetBlock from "../components/SignTransaction/SignTransactionSwapAssetBlock"
import SignTransactionApproveSpendAssetBlock from "../components/SignTransaction/SignTransactionApproveSpendAssetBlock"
import SignTransactionSignBlock from "../components/SignTransaction/SignTransactionSignBlock"
import SignTransactionNetworkAccountInfoTopBar from "../components/SignTransaction/SignTransactionNetworkAccountInfoTopBar"
import {
  useBackgroundDispatch,
  useBackgroundSelector,
  useAreKeyringsUnlocked,
} from "../hooks"
import NetworkFeesChooser from "../components/NetworkFees/NetworkFeesChooser"
import SignTransactionTransferBlock from "../components/SignTransaction/SignTransactionTransferBlock"

export enum SignType {
  Sign = "sign",
  SignSwap = "sign-swap",
  SignSpend = "sign-spend",
  SignTransfer = "sign-transfer",
}

interface SignLocationState {
  assetSymbol: string
  amount: number
  signType: SignType
  to: string
  value: string | number
}

export default function SignTransaction(): ReactElement {
  const areKeyringsUnlocked = useAreKeyringsUnlocked(true)

  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const location = useLocation<SignLocationState | undefined>()
  const { assetSymbol, amount, to, value, signType } = location.state ?? {
    signType: SignType.Sign,
  }
  const isTransactionDataReady = useBackgroundSelector(
    selectIsTransactionLoaded
  )

  const isTransactionSigned = useBackgroundSelector(selectIsTransactionSigned)
  const shouldBroadcastOnSign = useBackgroundSelector(
    ({ transactionConstruction }) =>
      transactionConstruction.broadcastOnSign ?? false
  )
  const signedTransaction = useBackgroundSelector(
    ({ transactionConstruction }) => transactionConstruction.signedTransaction
  )
  const transactionDetails = useBackgroundSelector(selectTransactionData)

  const [gasLimit, setGasLimit] = useState("")
  const estimatedFeesPerGas = useBackgroundSelector(selectEstimatedFeesPerGas)
  const [selectedEstimatedFeePerGas, setSelectedEstimatedFeePerGas] =
    useState<BlockEstimate>(
      estimatedFeesPerGas?.regular ?? {
        confidence: 0,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        price: 0n,
      }
    )

  const [panelNumber, setPanelNumber] = useState(0)
  const [isTransactionSigning, setIsTransactionSigning] = useState(false)

  useEffect(() => {
    if (areKeyringsUnlocked && isTransactionSigned && isTransactionSigning) {
      if (shouldBroadcastOnSign && typeof signedTransaction !== "undefined") {
        dispatch(broadcastSignedTransaction(signedTransaction))
      }

      // Request broadcast if not dApp...
      history.push("/singleAsset", { symbol: assetSymbol })
    }
  }, [
    areKeyringsUnlocked,
    isTransactionSigned,
    isTransactionSigning,
    history,
    assetSymbol,
    shouldBroadcastOnSign,
    signedTransaction,
    dispatch,
  ])

  const updateGasSettings = useCallback(
    async (estimate: BlockEstimate) => {
      setSelectedEstimatedFeePerGas(estimate)
      if (transactionDetails) {
        const transaction = {
          ...transactionDetails,
          maxFeePerGas: estimate.maxFeePerGas,
          maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
          gasLimit: BigInt(gasLimit),
        }
        dispatch(updateTransactionOptions(transaction))
      }
    },
    [dispatch, gasLimit, transactionDetails]
  )

  useEffect(() => {
    // FIXME Hackily handle the user not interacting with the fee selector for now.
    if (transactionDetails && transactionDetails.maxFeePerGas === 0n) {
      updateGasSettings(selectedEstimatedFeePerGas)
    }
  }, [transactionDetails, selectedEstimatedFeePerGas, updateGasSettings])

  if (!areKeyringsUnlocked) {
    return <></>
  }

  if (typeof transactionDetails === "undefined") {
    // TODO Some sort of unexpected state error if we end up here... Or do we
    // go back in history? That won't work for dApp popovers though.
    return <></>
  }

  const signContent: {
    [signType in SignType]: {
      title: string
      component: () => ReactElement
      confirmButtonText: string
    }
  } = {
    [SignType.SignSwap]: {
      title: "Swap assets",
      component: () => <SignTransactionSwapAssetBlock />,
      confirmButtonText: "Confirm",
    },
    [SignType.SignSpend]: {
      title: "Approve asset spend",
      component: () => <SignTransactionApproveSpendAssetBlock />,
      confirmButtonText: "Approve",
    },
    [SignType.SignTransfer]: {
      title: "Sign Transfer",
      component: () => (
        <SignTransactionTransferBlock
          token={assetSymbol ?? ""}
          amount={amount ?? 0}
          destination={to ?? ""}
          localizedValue={value ?? ""}
        />
      ),
      confirmButtonText: "Sign",
    },
    [SignType.Sign]: {
      title: "Sign Transaction",
      component: () => (
        <SignTransactionSignBlock transactionDetails={transactionDetails} />
      ),
      confirmButtonText: "Sign",
    },
  }

  const handleConfirm = async () => {
    if (isTransactionDataReady && transactionDetails) {
      dispatch(signTransaction(transactionDetails))
      setIsTransactionSigning(true)
    }
  }

  return (
    <section>
      <SignTransactionNetworkAccountInfoTopBar />
      <h1 className="serif_header title">{signContent[signType].title}</h1>
      <div className="primary_info_card standard_width">
        {signContent[signType].component()}
      </div>
      <SharedPanelSwitcher
        setPanelNumber={setPanelNumber}
        panelNumber={panelNumber}
        panelNames={["Details"]}
      />
      {panelNumber === 0 ? (
        <div className="detail_items_wrap standard_width_padded">
          {signType === SignType.Sign ? (
            <NetworkFeesChooser
              estimatedFeesPerGas={estimatedFeesPerGas}
              onSelectFeeOption={updateGasSettings}
              selectedGas={selectedEstimatedFeePerGas}
              gasLimit={gasLimit}
              setGasLimit={setGasLimit}
            />
          ) : (
            <span className="detail_item">
              Estimated network fee
              <span className="detail_item_right">
                ~
                {
                  formatUnits(transactionDetails.maxFeePerGas, "gwei").split(
                    "."
                  )[0]
                }{" "}
                Gwei
              </span>
            </span>
          )}
        </div>
      ) : null}
      <div className="footer_actions">
        <SharedButton
          iconSize="large"
          size="large"
          type="secondary"
          onClick={() => window.close()}
        >
          Reject
        </SharedButton>
        <SharedButton
          type="primary"
          iconSize="large"
          size="large"
          onClick={handleConfirm}
          showLoadingOnClick
        >
          {signContent[signType].confirmButtonText}
        </SharedButton>
      </div>
      <style jsx>
        {`
          section {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            background-color: var(--green-95);
          }
          .title {
            color: var(--trophy-gold);
            font-size: 36px;
            font-weight: 500;
            line-height: 42px;
            text-align: center;
          }
          .primary_info_card {
            display: block;
            height: fit-content;
            border-radius: 16px;
            background-color: var(--hunter-green);
            margin: 16px 0px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .footer_actions {
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
          .detail_item {
            width: 100%;
            color: var(--green-40);
            font-size: 14px;
            line-height: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .detail_items_wrap {
            display: flex;
            margin-top: 21px;
            flex-direction: column;
          }
          .detail_item_right {
            color: var(--green-20);
            font-size: 16px;
          }
        `}
      </style>
    </section>
  )
}
