import React from "react";
import {
  ToastAndroid,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import * as Permissions from "expo-permissions";
import { BarCodeScanner } from "expo-barcode-scanner";
import firebase from "firebase";
import db from "../config";

export default class TransactionScreen extends React.Component {
  constructor() {
    super();
    this.state = {
      hasCameraPermissions: null,
      scanned: false,
      scannedBookId: "",
      scannedStudentId: "",
      buttonState: "normal",
      transactionMessage: "",
    };
  }

  getCameraPermissions = async (id) => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);

    this.setState({
      /*status === "granted" is true when user has granted permission
        status === "granted" is false when user has not granted the permission
      */
      hasCameraPermissions: status === "granted",
      buttonState: id,
      scanned: false,
    });
  };

  handleBarCodeScanned = async ({ type, data }) => {
    const { buttonState } = this.state;
    console.log(buttonState);
    if (buttonState === "BookId") {
      this.setState({
        scanned: true,
        scannedBookId: data,
        buttonState: "normal",
      });
    } else if (buttonState === "StudentId") {
      this.setState({
        scanned: true,
        scannedStudentId: data,
        buttonState: "normal",
      });
    }
  };

  initiateBookIssue = async () => {
    //add a transaction
    db.collection("transactions").add({
      //err
      studentId: this.state.scannedStudentId,
      bookId: this.state.scannedBookId,
      data: firebase.firestore.Timestamp.now().toDate(),
      transactionType: "Issue",
    });

    alert("the book has been issued");

    //change book status
    db.collection("books").doc(this.state.scannedBookId).update({
      bookAvailability: false,
    });
    //change number of issued books for student
    db.collection("students")
      .doc(this.state.scannedStudentId)
      .update({
        numberOfBooksIssued: firebase.firestore.FieldValue.increment(1),
      });

    this.setState({
      scannedStudentId: "",
      scannedBookId: "",
    });
  };

  IStudentEldigibleForBook = async () => {
    const StudentRef = await db
      .collection("students")
      .where("studentId", "==", this.state.scannedStudentId)
      .get();
    var IsStudentEldigible = "";

    if (StudentRef.docs.length == 0) {
      IsStudentEldigible = false;
      Alert.alert("the studentid does not exist in the database");
      this.setState({ scannedStudentId: "", scannedBookId: "" });
    } else {
      StudentRef.docs.map((Doc) => {
        var student = Doc.data();

        if (student.numberOfBooksIssued < 2) {
          IsStudentEldigible = true;
          Alert.alert("your eldibible for issuing");
        } else {
          this.setState({ scannedBookId: "", scannedStudentId: "" });
          IsStudentEldigible = false;
          Alert.alert("to many books");
        }
      });
    }

    return IsStudentEldigible;
  };

  CheckIfWeCanReturnBook = async () => {
    const TransactionRef = await db
      .collection("transactions")
      .where("bookId", "==", this.state.scannedBookId)
      .limit(1)
      .get();
    var IsStudentEldigible = "";

    TransactionRef.docs.map((doc) => {
      var PreviousBookTransaction = doc.data();

      if (PreviousBookTransaction.studentId === this.state.scannedStudentId) {
        IsStudentEldigible = true;
        alert("you are edligibe for doing it");
      } else {
        IsStudentEldigible = false;
        this.setState({ scannedBookId: "", scannedStudentId: "" });
        alert("you are not the person who got the book");
      }
    });
    return IsStudentEldigible;
  };

  checkBookEligibility = async () => {
    const bookRef = await db
      .collection("Books")
      .where("bookId", "==", this.state.scannedBookId)
      .get();

    var transactionType = "";
    console.log(bookRef);
    if (bookRef.docs.length == 0) {
      transactionType = false;
      this.setState({ scannedBookId: "", scannedStudentId: "" });
      alert("the book you typed doesn't exist");
    } else {
      bookRef.docs.map((Doc) => {
        var Book = Doc.data();
        console.log(Book);
        if (Book.bookAvailability) {
          transactionType = "Issued";
        } else {
          transactionType = "return";
        }
      });
    }

    return transactionType;
  };

  initiateBookReturn = async () => {
    //add a transaction
    db.collection("transactions").add({
      studentId: this.state.scannedStudentId,
      bookId: this.state.scannedBookId,
      date: firebase.firestore.Timestamp.now().toDate(),
      transactionType: "Return",
    });

    //change book status
    db.collection("books").doc(this.state.scannedBookId).update({
      bookAvailability: true,
    });

    //change book status
    db.collection("students")
      .doc(this.state.scannedStudentId)
      .update({
        numberOfBooksIssued: firebase.firestore.FieldValue.increment(-1),
      });

    Alert.alert("the book has been returned");

    this.setState({
      scannedStudentId: "",
      scannedBookId: "",
    });
  };

  handleTransaction = async () => {
    var transactionType = await this.checkBookEligibility();

    if (!transactionType) {
      Alert.alert("dont exist");
      this.setState({ scannedBookId: "", scannedStudentId: "" });
    } else if (transactionType === "Issued") {
      var CanStudentUseTheBook = await this.IStudentEldigibleForBook();

      if (CanStudentUseTheBook) {
        this.initiateBookIssue();
        Alert.alert("it was given to the student");
      } else {
        var CanStudentReturnTheBook = await this.CheckIfWeCanReturnBook();

        if (CanStudentReturnTheBook) {
          this.initiateBookReturn();
          Alert.alert(" the book is back to the library");
        } else {
          Alert.alert(" you didn't own the book");
        }
      }
    }

    console.log(transactionType);

    var transactionMessage = null;
    db.collection("books")
      .doc(this.state.scannedBookId)
      .get()
      .then((doc) => {
        var book = doc.data();
        if (book.bookAvailability) {
          this.initiateBookIssue();
          transactionMessage = "Book Issued";
        } else {
          this.initiateBookReturn();
          transactionMessage = "Book Returned";
          // Alert.alert('')
        }

        Alert.alert(transactionMessage);
      });

    this.setState({
      transactionMessage: transactionMessage,
    });
  };

  render() {
    const hasCameraPermissions = this.state.hasCameraPermissions;
    const scanned = this.state.scanned;
    const buttonState = this.state.buttonState;

    console.log(buttonState, "      ", hasCameraPermissions);

    if (buttonState !== "normal" && hasCameraPermissions) {
      // this doesn't run because HasCamerapermissions is false
      return (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      );
    } else if (buttonState === "normal") {
      // button state is bookid so this doesn't run

      return (
        <KeyboardAvoidingView
          style={{ backgroundColor: "red" }}
          behavior="padding"
          enabled
        >
          <View>
            <Image
              source={require("../assets/booklogo.jpg")}
              style={{ width: 200, height: 200 }}
            />
            <Text style={{ textAlign: "center", fontSize: 30 }}>Wily</Text>
          </View>
          <View style={styles.inputView}>
            <TextInput
              onChangeText={(t) => {
                this.setState({ scannedBookId: t });
              }}
              style={styles.inputBox}
              placeholder="Book Id"
              value={this.state.scannedBookId}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => {
                this.getCameraPermissions("BookId");
              }}
            >
              <Text style={styles.buttonText}>Scan</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputView}>
            <TextInput
              onChangeText={(t) => {
                this.setState({ scannedStudentId: t });
              }}
              style={styles.inputBox}
              placeholder="Student Id"
              value={this.state.scannedStudentId}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => {
                this.getCameraPermissions("StudentId");
              }}
            >
              <Text style={styles.buttonText}>Scan</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.transactionAlert}>
            {this.state.transactionMessage}
          </Text>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={async () => {
              var transactionMessage = await this.handleTransaction();
              this.setState({ scannedBookId: "", scannedStudentId: "" });
            }}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      );
    } else {
      Alert.alert("you have to provide camera permissions.");
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  displayText: {
    fontSize: 15,
    textDecorationLine: "underline",
  },
  scanButton: {
    backgroundColor: "#2196F3",
    padding: 10,
    margin: 10,
  },
  buttonText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 10,
  },
  inputView: {
    flexDirection: "row",
    margin: 20,
  },
  inputBox: {
    width: 200,
    height: 40,
    borderWidth: 1.5,
    borderRightWidth: 0,
    fontSize: 20,
  },
  scanButton: {
    backgroundColor: "#66BB6A",
    width: 50,
    borderWidth: 1.5,
    borderLeftWidth: 0,
  },
  submitButton: {
    backgroundColor: "#FBC02D",
    width: 100,
    height: 50,
  },
  submitButtonText: {
    padding: 10,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
});
