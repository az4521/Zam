package moe.crafty.matrix;

import android.os.Build;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.PhoneAccountHandle;

import androidx.annotation.RequiresApi;

/**
 * The self-managed ConnectionService Telecom binds to for our calls. Thin by
 * design: {@link TelecomCalls} owns the state and the decisions.
 */
@RequiresApi(Build.VERSION_CODES.O)
public class MatrixConnectionService extends ConnectionService {

    @Override
    public Connection onCreateIncomingConnection(PhoneAccountHandle account, ConnectionRequest request) {
        return TelecomCalls.createIncoming(this, request);
    }

    @Override
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle account, ConnectionRequest request) {
        TelecomCalls.incomingFailed(this, request);
    }

    @Override
    public Connection onCreateOutgoingConnection(PhoneAccountHandle account, ConnectionRequest request) {
        return TelecomCalls.createOutgoing(this, request);
    }

    @Override
    public void onCreateOutgoingConnectionFailed(PhoneAccountHandle account, ConnectionRequest request) {
        TelecomCalls.outgoingFailed(request);
    }
}
