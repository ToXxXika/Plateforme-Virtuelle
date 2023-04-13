const functions = require("firebase-functions");
const corshandler = require("cors");
const cors = corshandler({origin: true});
const admin = require("firebase-admin");
const {jsPDF} = require('jspdf');
const Firestore = require('@google-cloud/firestore');
admin.initializeApp(functions.config().firebase);
const firestore = new Firestore({
    projectId: 'parkingapp-af332',
});


function generateRandomString() {
    const randomNumber = Math.floor(Math.random() * 100000);
    const randomString = "R" + randomNumber;
    return randomString;
}


exports.adduser = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const mail = req.body.email;
            const password = req.body.password;
            const nom = req.body.nom;
            const prenom = req.body.prenom;
            role = "EMPLOYEE";
            await firestore.collection("users").add({
                email: mail,
                password: password,
                nom: nom,
                prenom: prenom,
                role: role,
            }).then(async (doc) => {
                if (doc) {
                    await admin.auth().createUser({
                        email: mail,
                        password: password,

                    }).then((userRecord) => {
                        console.log("User created");
                        //send the code 200 to the client
                        const payload= {
                            status: 200,
                            message: "User created"
                        }

                        res.status(200).send(payload);
                    })
                }
            });

        } catch (error) {
            console.log(error);
            res.status(400).send(error);
        }
    });
});
exports.getUsers = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        await firestore.collection("users").get().then((snapshot) => {
            let users = [];
            snapshot.forEach((doc) => {
                users.push(doc.data());
            });
            res.status(200).send(users);
        })
    });
});
exports.userCreationNotification = functions.firestore.document("users/{userId}").onCreate((snap, context) => {
    const user = snap.data();
    const payload = {
        notification: {
            title: "New User",
            body: `${user.nom} ${user.prenom} has joined the app`,
            icon: "https://www.gstatic.com/mobilesdk/160503_mobilesdk/logo/2x/firebase_28dp.png",
            click_action: "https://parkingapp-af332.firebaseapp.com"

        }

    }
    //this function will initialize the reward collection in our database and assign 0 points to every user created
    firestore.collection("rewards").add({
        email:user.email,
        nom:user.nom,
        prenom:user.prenom,
        points:0,
    }).then(r => console.log("Reward added"));

  //  return admin.messaging().sendToTopic("users", payload);

})
exports.signin = functions.https.onRequest(async (req, res) => {
    console.log("Signin");
    cors(req, res, async () => {
        const email = req.body.email;
        const password = req.body.password;

        try {
            const user = await admin.auth().getUserByEmail(email);
            if (!user) {
                res.status(400).send("User not found");
            } else {
                console.log(user);
                const responseData = {
                    user: user,
                    status: 200
                };
                res.status(200).send(responseData);
            }


        } catch (error) {
            res.status(400).send(error)
        }
    });
});
exports.addCourse = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {

            await firestore.collection("courses").add({
                titre: req.body.titre,
                description: req.body.description,
                prix: req.body.prix,
                instructeur: req.body.instructeur,
                duree: req.body.duree,
                niveau: req.body.niveau,
            }).then((doc)=>{
              if(doc){
                  const payload={
                        status:200,
                        cours:doc
                  }
                res.status(200).send(payload);
              }
            });

        } catch (error) {
            console.log(error);
            res.status(400).send(error);
        }
    });
});
exports.getCourses = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        await firestore.collection("courses").get().then((snapshot) => {
            let courses = [];
            snapshot.forEach((doc) => {
                courses.push(doc.data());
            });
            res.status(200).send(courses);
        })
    });
});
exports.addreward = functions.firestore.document("rewards/{rewardId}").onUpdate({
    async update(snap, context) {
        const newValue = snap.after.data();
        const previousValue = snap.before.data();
        if (newValue.redeemed === true && previousValue.redeemed === false) {
            const user = await admin.auth().getUserByEmail(newValue.email);
            const points = user.points - newValue.points;
            await admin.auth().updateUser(user.uid, {
                points: points,
            });
            console.log("User points updated");
        }
    },
});
exports.DeployModule = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        const module = new Module(req.body.name, req.body.description);
        await firestore.collection("Module").add(module);
        res.status(200).send(module);

    });
});
exports.finishcourse = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const {userId, userEmail, coursePoints} = req.body;
            const userRef = firestore.collection("users").doc(userId);
            const user = await userRef.get();
            const updatedPoints = (user.data().points || 0) + coursePoints;
            await userRef.update({points: updatedPoints});
            const leaderboardRef = firestore.collection("leaderboard");
            const leaderboardEntryRef = leaderboardRef.doc(userId);
            const leaderboardEntry = await leaderboardEntryRef.get();
            if (leaderboardEntry.exists) {
                await leaderboardEntryRef.update({points: updatedPoints});
            } else {
                const newleaderboardEntry = new LeaderBoard(userId, userEmail, updatedPoints);
                await leaderboardRef.doc(userId).set(newleaderboardEntry);
            }

            res.status(200).send("Course finished and points updated");
        } catch (error) {
            console.error(error);
            res.status(400).send(error);
        }
    });
});

exports.sendMonthlyLeaderboardNotification = functions.pubsub.schedule("0 0 1  * *").onRun(async (context) => {
    try {
        const leaderboardRef = firestore.collection("leaderboard");
        const leaderboardSnapshot = await leaderboardRef.orderBy("points", "desc").limit(1).get();
        if (leaderboardSnapshot.empty) {
            console.log("No leaderboard entries");
            return;
        }
        const topuser = leaderboardSnapshot.docs[0].data();
        const payload = {
            notification: {
                title: "Monthly Leaderboard",
                body: `${topuser.email} is the top user this month with ${topuser.points} points`,
                icon: "https://www.gstatic.com/mobilesdk/160503_mobilesdk/logo/2x/firebase_28dp.png",
                click_action: "https://parkingapp-af332.firebaseapp.com"
            }
        };
        await admin.messaging().sendToTopic("users", payload);
        console.log("Monthly leaderboard notification sent ");
    } catch (error) {
        console.error(error);
    }
});
exports.startCourse = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const {mail, courstitle} = req.body;
            //how to get the user id from the mail
            const user = await admin.auth().getUserByEmail(mail);
            const userId = user.uid;
            //how to get the course id from the course title
            const courseSnapshot = await firestore.collection("courses").where("title", "==", courstitle).limit(1).get();
            if (courseSnapshot.empty) {
                throw new Error("Course not found");
            }
            const courseId = courseSnapshot.docs[0].id;

            await firestore.collection("userCourses").add({
                userId: userId,
                courseId: courseId,
                started: true,
                startedAt: firestore.FieldValue.serverTimestamp()

            });
            res.status(200).send("Course started");
        } catch (error) {
            console.error(error);
            res.status(400).send(error);
        }
    });
});


//TODO : change me later  please
exports.finishcourse = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const {userId, courseId} = req.body;
            const userCoursesRef = firestore().collection("userCourses");
            const userCourseSnapshot = await userCoursesRef.where("userId", "==", userId).where("courseId", "==", courseId).limit(1).get();
            if (userCourseSnapshot.empty) {
                throw new Error("User course not found");

            }
            const userCourseRef = userCourseSnapshot.docs[0].ref;
            await userCourseRef.update({
                finished: true,
                finishedAt: firestore.FieldValue.serverTimestamp()
            });
            const userRef = firestore.collection("users").doc(userId);
            const user = await userRef.get();
            const updatedPoints = (user.data().points || 0) + 10;
            await userRef.update({points: updatedPoints});
            res.status(200).send("Course finished and points updated");
        } catch (error) {
            console.log(error);
            res.status(400).send(error);
        }
    });
});
exports.addCommand = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const {nom,prenom,nomProduit,quantite,adresse,numeroTel,prixTotal} = req.body;
            console.log(nom,prenom,nomProduit,quantite,adresse,numeroTel,prixTotal);

            const commande = firestore.collection("commande").add({
                commandRef: generateRandomString(),
                quantite:quantite,
                product: nomProduit,
                Nom:nom,
                Prenom:prenom,
                Adresse:adresse,
                NumeroTel:numeroTel,
                prixTotal:prixTotal
            });
            if (commande) {
                /*update product quantity
                const productRef = firestore.collection("products").doc(product.id);
                const productData = await productRef.get();
                const updatedQuantity = productData.data().quantity - quantity;
                await productRef.update({quantity: updatedQuantity}).then((doc)=>{
                    console.log(doc+"updated");
                });

                 */

                const payload = {
                    status:200,
                    commande:commande
                }
                res.status(200).send(payload);
            }
        } catch (error) {
            console.log(error);
            res.status(400).send(error);
        }
    });
});
exports.getCommands = functions.https.onRequest(async (req, res) => {
    const commands = [];
    cors(req, res, async () => {
        try {
             await firestore.collection("commande").get().then((snapshot) => {
                snapshot.forEach((doc) => {
                    const commandData = {
                        ...doc.data()
                    };
                    commands.push(commandData);
                });
                res.status(200).send(commands);
            });

        } catch (error) {
            console.error(error)
        }

    });
});
exports.addProduct = functions.https.onRequest(async(req,res)=>{
    cors(req,res,async()=>{
        const {name,price,description,category,quantity,image} = req.body;
        const product = firestore.collection("product").add({
            name:name,
            price:price,
            description:description,
            category:category,
            image:image,
            quantity:quantity
        });
        if(product){
            const productData={
                status:200,
                message:"product added",
                produit:product
            }
            res.status(200).send(productData);
        }else {
            console.log("error")
            res.status(400).send("error");
        }
    });
});
exports.getProducts = functions.https.onRequest(async(req,res)=>{
    const products = [];
    cors(req,res,async()=>{
        try {
            await firestore.collection("product").get().then((snapshot)=>{
                snapshot.forEach((doc)=>{
                    const productData = {
                        ...doc.data()
                    };
                    products.push(productData);
                });
                res.status(200).send(products);
            });
        }catch (error) {
            console.error(error)
            res.status(400).send(error);
        }
    });
});
exports.getProductByCategory = functions.https.onRequest(async(req,res)=>{
    const products = [];
    cors(req,res,async()=>{
        try {
            const products = await firestore.collection("product").where("category","==",req.body.category).get().then((snapshot)=>{
                snapshot.forEach((doc)=>{
                    const productData = {
                        ...doc.data()
                    };
                    products.push(productData);
                });
                res.status(200).send(products);
            });
        }catch (error) {
            console.error(error)
            res.status(400).send(error);
        }
    });
});
exports.deleteUser= functions.https.onRequest(async (req,res)=>{
   cors(req,res,async ()=>{
       //delete the user from the datanase
       await firestore.collection("users").where()
   }) ;
});