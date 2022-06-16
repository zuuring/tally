import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { PermissionRequest } from "@tallyho/provider-bridge-shared"
import { createBackgroundAsyncThunk } from "./utils"
import { keyPermissionsByChainIdAddressOrigin } from "../services/provider-bridge/utils"

export type DAppPermissionState = {
  permissionRequests: { [origin: string]: PermissionRequest }
  allowed: {
    evm: {
      [chainID: string]: {
        [address: string]: {
          [origin: string]: PermissionRequest
        }
      }
    }
  }
  allowedPages: undefined
}

export const initialState: DAppPermissionState = {
  permissionRequests: {},
  allowed: { evm: {} },
  allowedPages: undefined,
}

export type Events = {
  requestPermission: PermissionRequest
  grantPermission: PermissionRequest
  denyOrRevokePermission: PermissionRequest
}

export const emitter = new Emittery<Events>()

// Async thunk to bubble the permissionGrant action from  store to emitter.
export const grantPermission = createBackgroundAsyncThunk(
  "dapp-permission/permissionGrant",
  async (permission: PermissionRequest) => {
    emitter.emit("grantPermission", {
      ...permission,
    })
    return permission
  }
)

// Async thunk to bubble the permissionDenyOrRevoke action from  store to emitter.
export const denyOrRevokePermission = createBackgroundAsyncThunk(
  "dapp-permission/permissionDenyOrRevoke",
  async (permission: PermissionRequest) => {
    await emitter.emit("denyOrRevokePermission", permission)
    return permission
  }
)

const dappSlice = createSlice({
  name: "dapp-permission",
  initialState,
  reducers: {
    initializeAllowedPages: (
      immerState,
      {
        payload: allowed,
      }: {
        payload: {
          evm: {
            [chainID: string]: {
              [address: string]: {
                [origin: string]: PermissionRequest
              }
            }
          }
        }
      }
    ) => {
      immerState.allowed = allowed
    },
    requestPermission: (
      state,
      { payload: request }: { payload: PermissionRequest }
    ) => {
      if (state.permissionRequests[request.key]?.state !== "allow") {
        return {
          ...state,
          permissionRequests: {
            // Quick fix: store only the latest permission request.
            // TODO: put this back when we fixed the performance issues and/or updated our UI to handle multiple requests
            // ...state.permissionRequests,
            [request.key]: { ...request },
          },
        }
      }

      return state
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(
        grantPermission.fulfilled,
        (
          immerState,
          { payload: permission }: { payload: PermissionRequest }
        ) => {
          const updatedPermissionRequests = { ...immerState.permissionRequests }
          delete updatedPermissionRequests[permission.key]

          const allowedPermission = keyPermissionsByChainIdAddressOrigin(
            [permission],
            immerState.allowed
          )

          immerState.allowed = allowedPermission
        }
      )
      .addCase(
        denyOrRevokePermission.fulfilled,
        (
          immerState,
          { payload: permission }: { payload: PermissionRequest }
        ) => {
          const updatedPermissionRequests = { ...immerState.permissionRequests }
          delete updatedPermissionRequests[permission.key]

          const { [permission.origin]: _, ...withoutOriginToRemove } =
            immerState.allowed.evm[permission.chainID][
              permission.accountAddress
            ]

          immerState.allowed.evm[permission.chainID][
            permission.accountAddress
          ] = withoutOriginToRemove
        }
      )
  },
})

export const { requestPermission, initializeAllowedPages } = dappSlice.actions

export default dappSlice.reducer
